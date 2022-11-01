const { promises: Fs } = require('fs');
const sqlite3 = require('sqlite3');
const Path = require('path');
const { resolve } = require('path');
const dbName = 'db.db';
let db;


async function exists(path) {
  try {
    await Fs.access(path)
    return true
  } catch {
    return false
  }
}


function createDatabase() {
  db = new sqlite3.Database(dbName, (err) => {
    if (err) {
      console.log("Error Creating DB: " + err);
      exit(1);
    }
    createTables();
  });
}

function createTables() {
  db.exec(`
    CREATE TABLE games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gameId TEXT NOT NULL,
        status TEXT NOT NULL,
        currentFactId INT,
        hostPlayerId INT NOT NULL
    );

    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gameId TEXT NOT NULL,
        token TEXT NOT NULL,
        username TEXT NOT NULL,
        points INT NOT NULL
    );
    
    CREATE TABLE facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gameId TEXT NOT NULL,
        "text" TEXT NOT NULL,
        authorId INT NOT NULL,
        used INT NOT NULL
    );

    CREATE TABLE scoreboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gameId TEXT NOT NULL,
        selectedFactId INT NOT NULL,
        votingPlayerId INT NOT NULL,
        votedPlayerId INT NOT NULL
    );
`, (e) => {
    console.log('tables created', e)
  });
}

async function createNewUser(data) {
  return new Promise(function (resolve, reject){

  
  try {
    const token = Math.random().toString(36).slice(2);
    const query = `INSERT INTO users (gameId, token, username, points) VALUES (?,?,?,?)`;
    db.run(query, [data.gameId, token, data.username, 0], function (error) {
      if (error){
        reject(error);
        return;
      }

      resolve({
        id: this.lastID,
        token,
        username: data.username,
        points: 0,
        gameId: data.gameId,
      });
    });
  } catch (e) {
    console.log('Error creating user: ' + e)
    reject(e)
  }
});
}

async function getCurrentPlayers(gameId) {
  return new Promise((resolve, reject) => {
    const data = [];
    db.all('SELECT id, username, points FROM users WHERE gameId = ?', [gameId],
      (err, rows) => {
        if (err) {
          reject(err)
          return;
        }
        rows.forEach((row) => {
          data.push(row);
        });

        resolve(data);
      });
  });
}

async function createNewFact({ gameId, text, authorId }) {
  return new Promise(async (resolve, reject) => {

    const query = `
    INSERT INTO facts (gameId, "text", authorId, used)
    VALUES (?,?,?,?)`;
    db.run(query, [gameId, text, authorId, 0], function (error) {
      if (error) {
        reject(error);
      }
      resolve({
        id: this.lastID,
        gameId,
        text,
        authorId,
        used: 0,
      });
    });
  });
}

async function getCurrentFacts(gameId, authorId) {
  return new Promise((resolve, reject) => {
    const data = [];
    db.all('SELECT id, "text", used FROM facts WHERE gameId = ? AND authorId = ? AND used = 0', [gameId, authorId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        rows.forEach((row) => {
          data.push(row);
        });

        resolve(data);
      });
  });
}

async function getFactById(idFact, includeAuthor = true) {
  return await new Promise((resolve, reject) => {
    const fields = ['id', '"text"'];
    if (includeAuthor) { fields.push('authorId') }
    const query = `SELECT ${fields.join(',')} FROM facts WHERE id = ?`;
    db.get(query, [idFact],
      (err, row) => {
        if (err) {
          reject(err)
          return;
        }

        resolve(row);
      });
  });
}

async function getBaseGame(gameId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM games WHERE gameId = ? LIMIT 1`, [gameId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        reject({ code: 'NO_GAME', msg: "Game does not exist" });
        return;
      }
      resolve(row);
    });
  });
}
async function getGame(gameId, currentPlayerId) {
  return new Promise(async (resolve, reject) => {
    try{
      const game = await getBaseGame(gameId);

      const currentPlayers = await getCurrentPlayers(gameId);

      // return only "my" facts
      const myFacts = await getCurrentFacts(gameId, currentPlayerId);
      let currentFact;
      if (game.currentFactId) {
        currentFact = await getFactById(game.currentFactId, false)
      }
      const totalFacts = await getTotalFacts(gameId);

      const response = {
        ...game,
        players: currentPlayers,
        myFacts,
        currentFact,
        totalFacts
      }
      
      resolve(response);
    }catch(e){reject(e)}
  });
}

async function getCurrentPlayer(token) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, gameId, points FROM users WHERE token = ?', [token],
      (err, player) => {
        if (err) {
          reject(err);
          return;
        }
        if (!player) {
          reject({ code: 'NO_PLAYER', msg: "Player not found" });
          return;
        }
        resolve(player);
      });
  });
}

async function getPlayerByUsername(gameId, username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, gameId, points, token FROM users WHERE gameId = ? AND username = ?',
      [gameId, username],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (!row) {
          reject({ code: 'NO_PLAYER', msg: "Player not found" });
          return;
        }

        resolve(row);
      });
  });
}

async function getPlayerById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, gameId, points FROM users WHERE id = ? LIMIT 1',
      [id],
      (err, row) => {
        if (err) {
          reject(err)
          return;
        }
        if (!row) {
          reject({ code: 'NO_PLAYER', msg: "Player does not exist" });
        }

        resolve(row);
      });
  });
}

async function createGame(gameId, hostPlayerId, callback) {
  try {
    const query = db.prepare(`
            INSERT INTO games (gameId, status, hostPlayerId)
            VALUES (?,?,?)`);
    const status = 'standby';
    await query.run(gameId, status, hostPlayerId);
    query.finalize();
    getGame(gameId, hostPlayerId).then(callback);

  } catch (e) {
    console.log('Error creating game: ' + e)
  }
}

async function updateGame({ status, gameId, currentFactId }) {
  return new Promise((resolve, reject) => {
    try {
      const query = `UPDATE games SET status = ?, currentFactId = ? WHERE gameId = ?`;
      db.run(query, [status, currentFactId, gameId])
      resolve(gameId);
    } catch (e) {
      reject(e);
    }
  });
}

async function markFactAsUsed(factId) {
  return new Promise((resolve, reject) => {
    try {
      const query = `UPDATE facts SET used = 1 WHERE id = ?`;
      db.run(query, [factId]);
      resolve(factId)
    } catch (e) {
      reject(e);
    }
  });
}

function getRandomFact(gameId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, "text", authorId FROM facts 
            WHERE gameId = ? AND used = 0 
            ORDER BY RANDOM() LIMIT 1`, [gameId],
      (err, fact) => {
        if (err) {
          reject(err);
          return;
        }
        if (!fact){
          reject({code: 'NO_FACTS'});
          return;
        }
        resolve(fact.id);
      });
  });
}
function getTotalFacts(gameId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(id) as total FROM facts 
            WHERE gameId = ? AND used = 0`, [gameId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row.total);
      });
  });
}

function getAuthorByFactId(factId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, username FROM users 
            INNER JOIN facts ON facts.authorId = users.id 
            WHERE facts.id = ? LIMIT 1`, [factId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
  });
}

async function submitVote(data) {
  const { gameId, selectedFactId, votingPlayerId, votedPlayerId } = data;
  return new Promise((resolve, reject) => {
    const query = `
    INSERT INTO scoreboard (gameId, selectedFactId, votingPlayerId, votedPlayerId)
    VALUES (?,?,?,?)`;

    db.run(query, [gameId, selectedFactId, votingPlayerId, votedPlayerId], function (error) {
      if (error) {
        reject(error);
      }
      resolve(data);
    });
  });
}

function alreadyVoted(gameId, factId, voterId){
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM scoreboard WHERE gameId = ? AND selectedFactId = ? AND votingPlayerId = ? LIMIT 1`;
    db.get(query, [gameId, factId, voterId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
  });
}

function updatePlayerPoints(playerId, points){
  return new Promise((resolve, reject) => {
    try {
      const query = `UPDATE users SET points = ? WHERE id = ?`;
      db.run(query, [points, playerId], (error)=>{
        reject(error);
      })
      resolve(playerId);
    } catch (e) {
      reject(e);
    }
  });
}
function updateVote(id, target){
  return new Promise((resolve, reject) => {
    try {
      const query = `UPDATE scoreboard SET votedPlayerId = ? WHERE id = ?`;
      db.run(query, [target, id], (error)=>{
        reject(error);
      })
      resolve(id);
    } catch (e) {
      reject(e);
    }
  });
}

function deleteVote(id){
  return new Promise((resolve, reject) => {
    try {
      const query = `DELETE FROM scoreboard WHERE id = ?`;
      db.run(query, id, (error)=>{
        reject(error);
      })
      resolve(id);
    } catch (e) {
      reject(e);
    }
  });
}
function deleteFact(id){
  return new Promise((resolve, reject) => {
    try {
      const query = `DELETE FROM facts WHERE id = ?`;
      db.run(query, id, (error)=>{
        reject(error);
      })
      resolve(id);
    } catch (e) {
      reject(e);
    }
  });
}

function getScoreboard(gameId, factId) {
  return new Promise((resolve, reject) => {
    const data = [];
    const query = `SELECT * FROM scoreboard WHERE gameId = ? AND selectedFactId = ?`;
    db.all(query, [gameId, factId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        rows.forEach((row) => {
          data.push(row);
        });

        resolve(data);
      });
  });
}


const path = Path.join(__dirname, dbName);
exists(path).then((dbExists) => {
  db = new sqlite3.Database(dbName, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (!dbExists || (err && err.code == "SQLITE_CANTOPEN")) {
      console.log('cant open, create db')
      createDatabase();
      return;
    } else if (err) {
      console.log("Error Connecting to DB: " + err);
      exit(1);
    }
  });
});

module.exports = {
  createNewUser,
  getGame,
  createGame,
  createNewFact,
  updateGame,
  getRandomFact,
  markFactAsUsed,
  getFactById,
  getAuthorByFactId,
  getCurrentPlayer,
  getPlayerByUsername,
  getPlayerById,
  submitVote,
  getScoreboard,
  alreadyVoted,
  updateVote,
  getBaseGame,
  deleteVote,
  updatePlayerPoints,
  deleteFact,
}