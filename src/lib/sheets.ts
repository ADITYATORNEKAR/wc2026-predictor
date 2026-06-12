import { google, sheets_v4 } from "googleapis";
import { randomUUID } from "crypto";
import { Prediction, SpecialPrediction, SpecialPredictionType } from "./types";
import { calculatePoints, PredictionOutcome } from "./scoring";
import { MATCHES } from "./matches";
import { KNOCKOUT_MATCHES } from "./knockout-matches";

const PREDICTIONS_RANGE = "Predictions!A2:F";
const MATCHES_RANGE = "Matches!A2:H";

export function getSheetId(): string {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEETS_ID environment variable");
  }
  return sheetId;
}

export function getSheetsClient(): sheets_v4.Sheets {
  const encodedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!encodedKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable");
  }

  let credentials: Record<string, unknown>;
  try {
    const decoded = Buffer.from(encodedKey, "base64").toString("utf-8");
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64-encoded JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export class MatchStartedError extends Error {
  constructor() {
    super("Cannot edit prediction — match has already started");
    this.name = "MatchStartedError";
  }
}

function rowToPrediction(row: string[], rowIndex: number): Prediction {
  return {
    id: row[0] ?? "",
    userName: row[1] ?? "",
    matchId: row[2] ?? "",
    prediction: (row[3] as PredictionOutcome) ?? "draw",
    points: row[4] === undefined || row[4] === "" ? undefined : Number(row[4]),
    submittedAt: row[5] ?? "",
  };
}

export async function getPredictions(): Promise<Prediction[]> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];
    return rows.map((row, index) => rowToPrediction(row as string[], index));
  } catch (error) {
    throw new Error(
      `Failed to fetch predictions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function upsertPrediction(
  pred: Omit<Prediction, "id" | "points">
): Promise<{ action: "created" | "updated" }> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const match = [...MATCHES, ...KNOCKOUT_MATCHES].find((m) => m.id === pred.matchId);

    if (!match) {
      throw new Error(`Match with id "${pred.matchId}" not found`);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex(
      (row) => row[1] === pred.userName && row[2] === pred.matchId
    );

    if (rowIndex === -1) {
      const id = randomUUID();

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: PREDICTIONS_RANGE,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              id,
              pred.userName,
              pred.matchId,
              pred.prediction,
              "",
              pred.submittedAt,
            ],
          ],
        },
      });

      return { action: "created" };
    }

    if (new Date(match.matchDate) <= new Date()) {
      throw new MatchStartedError();
    }

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `Predictions!D${sheetRow}`,
            values: [[pred.prediction]],
          },
          {
            range: `Predictions!F${sheetRow}`,
            values: [[pred.submittedAt]],
          },
        ],
      },
    });

    return { action: "updated" };
  } catch (error) {
    if (error instanceof MatchStartedError) {
      throw error;
    }
    throw new Error(
      `Failed to save prediction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function setMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex((row) => row[0] === matchId);

    if (rowIndex === -1) {
      throw new Error(`Match with id "${matchId}" not found in Matches sheet`);
    }

    const sheetRow = rowIndex + 2; // account for header row + 1-based indexing

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Matches!G${sheetRow}:H${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[homeScore, awayScore]],
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to set match result for "${matchId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function recalculatePoints(matchId: string): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const matchesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const matchRows = matchesResponse.data.values ?? [];
    const matchRow = matchRows.find((row) => row[0] === matchId);

    if (!matchRow) {
      throw new Error(`Match with id "${matchId}" not found in Matches sheet`);
    }

    const actualHome = matchRow[6];
    const actualAway = matchRow[7];

    if (actualHome === undefined || actualHome === "" || actualAway === undefined || actualAway === "") {
      throw new Error(`Match "${matchId}" does not have a result set yet`);
    }

    const actualHomeScore = Number(actualHome);
    const actualAwayScore = Number(actualAway);

    const predictionsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: PREDICTIONS_RANGE,
    });

    const predictionRows = predictionsResponse.data.values ?? [];

    const data: sheets_v4.Schema$ValueRange[] = [];

    predictionRows.forEach((row, index) => {
      if (row[2] !== matchId) return;

      const prediction = row[3] as PredictionOutcome;
      const points = calculatePoints(prediction, actualHomeScore, actualAwayScore);
      const sheetRow = index + 2;

      data.push({
        range: `Predictions!E${sheetRow}`,
        values: [[points]],
      });
    });

    if (data.length === 0) {
      return;
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to recalculate points for "${matchId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const LEAGUES_RANGE = "Leagues!A2:B";
const LEAGUE_MEMBERS_RANGE = "LeagueMembers!A2:D";

export async function getLeagues(): Promise<string[]> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: LEAGUES_RANGE,
    });

    const rows = response.data.values ?? [];
    return rows.map((row) => row[0] ?? "").filter((name) => name !== "");
  } catch (error) {
    throw new Error(
      `Failed to fetch leagues: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getLeagueMembers(
  leagueName: string
): Promise<{ userName: string; userEmail: string }[]> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: LEAGUE_MEMBERS_RANGE,
    });

    const rows = response.data.values ?? [];
    return rows
      .filter((row) => row[2] === leagueName)
      .map((row) => ({ userName: row[0] ?? "", userEmail: row[1] ?? "" }));
  } catch (error) {
    throw new Error(
      `Failed to fetch league members: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function joinLeague(userName: string, userEmail: string, leagueName: string): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: LEAGUE_MEMBERS_RANGE,
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex((row) => row[1] === userEmail);

    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: LEAGUE_MEMBERS_RANGE,
        valueInputOption: "RAW",
        requestBody: {
          values: [[userName, userEmail, leagueName, new Date().toISOString()]],
        },
      });
      return;
    }

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `LeagueMembers!C${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[leagueName]],
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to join league: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getUserLeague(userEmail: string): Promise<string | null> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: LEAGUE_MEMBERS_RANGE,
    });

    const rows = response.data.values ?? [];
    const row = rows.find((r) => r[1] === userEmail);

    return row ? (row[2] ?? null) : null;
  } catch (error) {
    throw new Error(
      `Failed to fetch user league: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const SPECIAL_PREDICTIONS_RANGE = "SpecialPredictions!A2:G";

const SPECIAL_PREDICTION_POINTS: Record<SpecialPredictionType, number> = {
  topscorer: 30,
  wcwinner: 50,
};

function rowToSpecialPrediction(row: string[]): SpecialPrediction {
  return {
    id: row[0] ?? "",
    userName: row[1] ?? "",
    userEmail: row[2] ?? "",
    type: (row[3] as SpecialPredictionType) ?? "topscorer",
    pick: row[4] ?? "",
    points: row[5] === undefined || row[5] === "" ? undefined : Number(row[5]),
    submittedAt: row[6] ?? "",
  };
}

export async function getSpecialPredictions(userName?: string): Promise<SpecialPrediction[]> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SPECIAL_PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];
    const predictions = rows.map((row) => rowToSpecialPrediction(row as string[]));

    if (userName === undefined) return predictions;

    return predictions.filter((prediction) => prediction.userName === userName);
  } catch (error) {
    throw new Error(
      `Failed to fetch special predictions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function upsertSpecialPrediction(data: {
  userName: string;
  userEmail: string;
  type: SpecialPredictionType;
  pick: string;
}): Promise<{ action: "created" | "updated" }> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SPECIAL_PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex(
      (row) => row[1] === data.userName && row[3] === data.type
    );

    if (rowIndex === -1) {
      const id = randomUUID();

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: SPECIAL_PREDICTIONS_RANGE,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [id, data.userName, data.userEmail, data.type, data.pick, "", new Date().toISOString()],
          ],
        },
      });

      return { action: "created" };
    }

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `SpecialPredictions!E${sheetRow}`,
            values: [[data.pick]],
          },
          {
            range: `SpecialPredictions!G${sheetRow}`,
            values: [[new Date().toISOString()]],
          },
        ],
      },
    });

    return { action: "updated" };
  } catch (error) {
    throw new Error(
      `Failed to save special prediction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function setSpecialPredictionResult(
  type: SpecialPredictionType,
  correctAnswer: string
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SPECIAL_PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];
    const pointsForCorrect = SPECIAL_PREDICTION_POINTS[type];

    const data: sheets_v4.Schema$ValueRange[] = [];

    rows.forEach((row, index) => {
      if (row[3] !== type) return;

      const points = row[4] === correctAnswer ? pointsForCorrect : 0;
      const sheetRow = index + 2;

      data.push({
        range: `SpecialPredictions!F${sheetRow}`,
        values: [[points]],
      });
    });

    if (data.length === 0) return;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to set special prediction result for "${type}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface LeaderboardEntry {
  name: string;
  points: number;
  totalPoints: number;
  matchPoints: number;
  specialPoints: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const [predictions, specialPredictions] = await Promise.all([
      getPredictions(),
      getSpecialPredictions(),
    ]);

    const matchTotals = new Map<string, number>();
    for (const prediction of predictions) {
      const current = matchTotals.get(prediction.userName) ?? 0;
      matchTotals.set(prediction.userName, current + (prediction.points ?? 0));
    }

    const specialTotals = new Map<string, number>();
    for (const prediction of specialPredictions) {
      const current = specialTotals.get(prediction.userName) ?? 0;
      specialTotals.set(prediction.userName, current + (prediction.points ?? 0));
    }

    const names = new Set([...matchTotals.keys(), ...specialTotals.keys()]);

    return Array.from(names)
      .map((name) => {
        const matchPoints = matchTotals.get(name) ?? 0;
        const specialPoints = specialTotals.get(name) ?? 0;
        const totalPoints = matchPoints + specialPoints;
        return { name, points: totalPoints, totalPoints, matchPoints, specialPoints };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (error) {
    throw new Error(
      `Failed to build leaderboard: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
