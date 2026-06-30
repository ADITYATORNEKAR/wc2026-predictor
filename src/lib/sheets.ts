import { google, sheets_v4 } from "googleapis";
import { randomUUID } from "crypto";
import { Prediction, SpecialPrediction, SpecialPredictionType } from "./types";
import { calculatePoints, calculateKnockoutPoints, PredictionOutcome } from "./scoring";

const PREDICTIONS_RANGE = "Predictions!A2:F";
const MATCHES_RANGE = "Matches!A2:L";
const CONFIG_RANGE = "Config!A2:C";

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

    // Read all existing predictions. PREDICTIONS_RANGE starts at row 2,
    // so array index 0 corresponds to sheet row 2.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex(
      (row) => row[1] === pred.userName && row[2] === pred.matchId
    );

    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: PREDICTIONS_RANGE,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              randomUUID(),
              pred.userName,
              pred.matchId,
              pred.prediction,
              "", // points — empty until result is set
              pred.submittedAt,
            ],
          ],
        },
      });

      return { action: "created" };
    }

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Predictions!D${sheetRow}:F${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            pred.prediction, // column D — updated pick
            "", // column E — clear points, pick has changed
            pred.submittedAt, // column F — updated timestamp
          ],
        ],
      },
    });

    return { action: "updated" };
  } catch (error) {
    throw new Error(
      `Failed to save prediction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface MatchResultRow {
  home: string;
  away: string;
  winner: string;
  decidedBy: string;
  homePenalty: string;
  awayPenalty: string;
}

export async function getMatchResultsMap(): Promise<Record<string, MatchResultRow>> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const rows = response.data.values ?? [];
    const map: Record<string, MatchResultRow> = {};

    rows.forEach((row) => {
      const matchId = row[0];
      if (!matchId) return;
      map[matchId] = {
        home: row[6] ?? "",
        away: row[7] ?? "",
        winner: row[8] ?? "",
        decidedBy: row[9] ?? "",
        homePenalty: row[10] ?? "",
        awayPenalty: row[11] ?? "",
      };
    });

    return map;
  } catch (error) {
    throw new Error(
      `Failed to fetch match results: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getMatchResult(matchId: string): Promise<MatchResultRow | null> {
  const map = await getMatchResultsMap();
  return map[matchId] ?? null;
}

export async function setMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  winner?: "home" | "away" | null,
  decidedBy?: "FT" | "AET" | "PEN",
  homePenalty?: number,
  awayPenalty?: number
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

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Matches!G${sheetRow}:L${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            homeScore,
            awayScore,
            winner ?? "",
            decidedBy ?? "",
            homePenalty ?? "",
            awayPenalty ?? "",
          ],
        ],
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to set match result for "${matchId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Matches where every user is awarded full credit (3 pts) regardless of their
// pick or the real result — used when users were unable to submit predictions
// in time due to a platform bug. This overrides normal scoring permanently,
// so future syncs/recalculations don't silently undo the credit once the
// real result comes in.
const FORCED_CREDIT_MATCH_IDS = new Set(["k1", "k2", "k4"]);

export async function recalculatePoints(matchId: string): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const isForcedCredit = FORCED_CREDIT_MATCH_IDS.has(matchId);
    const isKnockout = matchId.startsWith("k");

    let actualHomeScore = 0;
    let actualAwayScore = 0;
    let winner: "home" | "away" | undefined;

    if (!isForcedCredit) {
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
      winner = matchRow[8] as "home" | "away" | undefined;

      if (actualHome === undefined || actualHome === "" || actualAway === undefined || actualAway === "") {
        throw new Error(`Match "${matchId}" does not have a result set yet`);
      }

      actualHomeScore = Number(actualHome);
      actualAwayScore = Number(actualAway);
    }

    const predictionsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: PREDICTIONS_RANGE,
    });

    const predictionRows = predictionsResponse.data.values ?? [];

    const data: sheets_v4.Schema$ValueRange[] = [];

    predictionRows.forEach((row, index) => {
      if (row[2] !== matchId) return;

      const prediction = row[3] as PredictionOutcome;
      const points = isForcedCredit
        ? 3
        : isKnockout && winner
          ? calculateKnockoutPoints(prediction, winner)
          : calculatePoints(prediction, actualHomeScore, actualAwayScore);
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

export async function getConfig(key: string): Promise<string | null> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: CONFIG_RANGE,
    });

    const rows = response.data.values ?? [];
    const row = rows.find((r) => r[0] === key);

    return row?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function setConfig(key: string, value: string): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    let rows: string[][] = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: CONFIG_RANGE,
      });
      rows = (response.data.values as string[][] | undefined) ?? [];
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            { addSheet: { properties: { title: "Config" } } },
          ],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Config!A1:C1",
        valueInputOption: "RAW",
        requestBody: { values: [["key", "value", "updatedAt"]] },
      });
    }

    const rowIndex = rows.findIndex((r) => r[0] === key);

    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: CONFIG_RANGE,
        valueInputOption: "RAW",
        requestBody: {
          values: [[key, value, new Date().toISOString()]],
        },
      });
      return;
    }

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Config!B${sheetRow}:C${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[value, new Date().toISOString()]],
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to set config "${key}": ${error instanceof Error ? error.message : String(error)}`
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
