import { google, sheets_v4 } from "googleapis";
import { randomUUID } from "crypto";
import { Prediction } from "./types";
import { calculatePoints } from "./scoring";

const PREDICTIONS_RANGE = "Predictions!A2:G";
const MATCHES_RANGE = "Matches!A2:H";

function getSheetId(): string {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEETS_ID environment variable");
  }
  return sheetId;
}

function getSheetsClient(): sheets_v4.Sheets {
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
    predictedHome: Number(row[3]),
    predictedAway: Number(row[4]),
    points: row[5] === undefined || row[5] === "" ? undefined : Number(row[5]),
    submittedAt: row[6] ?? "",
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

export async function addPrediction(
  pred: Omit<Prediction, "id" | "points">
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

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
            pred.predictedHome,
            pred.predictedAway,
            "",
            pred.submittedAt,
          ],
        ],
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to add prediction: ${error instanceof Error ? error.message : String(error)}`
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

      const predictedHome = Number(row[3]);
      const predictedAway = Number(row[4]);
      const points = calculatePoints(predictedHome, predictedAway, actualHomeScore, actualAwayScore);
      const sheetRow = index + 2;

      data.push({
        range: `Predictions!F${sheetRow}`,
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

export async function getLeaderboard(): Promise<{ name: string; points: number }[]> {
  try {
    const predictions = await getPredictions();

    const totals = new Map<string, number>();

    for (const prediction of predictions) {
      const current = totals.get(prediction.userName) ?? 0;
      totals.set(prediction.userName, current + (prediction.points ?? 0));
    }

    return Array.from(totals.entries())
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points);
  } catch (error) {
    throw new Error(
      `Failed to build leaderboard: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
