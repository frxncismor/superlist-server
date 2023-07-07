const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/getList', (req, res) => {
  authorize().then(async response => {
    let list = await getList(response);
    res.json(list);
  }).catch(console.error);
});

app.get('/api/authorize', (req, res) => {
  authorize().then(async response => {
    res.json(response);
  }).catch(console.error);
});

app.put('/api/updateCost/:value/:cell', (req, res) => {
  const value = req.params.value;
  const cell = req.params.cell;

  authorize()
    .then(async (response) => {
      const updated = await updateCost(value, cell, response);
      res.json(updated);
    })
    .catch(console.error);
});


app.listen(port, () => {
  console.log('Server listenting on at http://localhost:' + port);
});
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function getList(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEETID,
    range: "'Ingredientes Totales Quincenales'!A3:G28",
  });
  let ingredientList = [];
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    console.log('No data found.');
    return;
  }
  // console.log(rows);
  rows.forEach((row) => {
    let ingredient = {
      name: row[0],
      need_to_buy: row[5],
      measure: row[4],
      cost: row[3],
      cost_cell: row[6]
    };
    ingredientList.push(ingredient);
    // Print columns A and E, which correspond to indices 0 and 4.
  });
  return ingredientList;

}

async function updateCost(newValue, cost_cell) {
  const authClient = await authorize();
  const sheets = google.sheets('v4', authClient);
  const request = {
    spreadsheetId: process.env.SPREADSHEETID,
    range: "'Ingredientes Totales Quincenales'!D" + cost_cell,
    valueInputOption: 'RAW',
    resource: {
      // TODO: Add desired properties to the request body. All existing properties
      // will be replaced.
        "values": [
          [
            newValue
          ]
        ]
      
    },
    auth: authClient,
  };
  try {
    const response = (await sheets.spreadsheets.values.update(request)).data;
    // TODO: Change code below to process the `response` object:
    return response;
  } catch (err) {
    console.error(err);
  }
}