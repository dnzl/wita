/**
 * GAME
 *  id
 *  gameId
 *  status
 *  currentFactId
 *  hostPlayerId
 *  
 * USERS
 *  id
 *  authToken
 *  gameId
 *  username
 *  points
 * 
 * FACTS
 *  id
 *  gameId
 *  text
 *  authorId
 *  used (bool para disable delete)
 * 
 * SCOREBOARD
 *  id
 *  gameId
 *  selectedFactId
 *  votingPlayerId
 *  votedPlayerId
 * 
 */



const express = require('express');
const cors = require('cors');
const app = express();
const port = 3500;

const {
  createNewUser, getGame, updateGame, createGame,
  createNewFact, getRandomFact, markFactAsUsed, getFactById, submitVote, alreadyVoted, updateVote, deleteVote,
  getCurrentPlayer, getPlayerByUsername, getPlayerById, getScoreboard, getBaseGame, updatePlayerPoints, deleteFact
} = require('./queries');

app.use(cors());
app.use(express.json());

app.post('/register', function (req, res) {
  const gameId = req.body.gameId;
  const username = req.body.username;

  // promise returns { player, gameId, game }
  new Promise(async (resolve, reject) => {
    let player;
    try {
      player = await getPlayerByUsername(gameId, username);
    } catch (e) {
      if (e.code === 'NO_PLAYER') {
        player = await createNewUser({ username, gameId });
      }
    }
    if (!player) {
      console.error('cant obtain or create user, why?', { player, gameId, username })
    }
    try {
      const game = await getGame(gameId, player.id);
      resolve({
        player,
        gameId,
        game
      });
    } catch (e) {
      if (e.code === "NO_GAME") {
        await createGame(gameId, player.id, (game) => {
          resolve({
            game,
            player,
            gameId
          })
        });
        return;
      }
      reject(e);
    }
  }).then(response => {
    happyResponse(res, response);
  })
    .catch(e => errorResponse(res, 400, e));
});



app.post('/create-game', function (req, res) {
  const { gameId } = req.body;
  const { token } = req.headers;

  return new Promise((res, rej) => {

    getCurrentPlayer(token).then(user => {
      createGame(gameId, user.id, game => res(game));
    }).catch(e => {
      rej(e);
    });
  }).then((game) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/json');
    res.json({ game });
  }).catch(e => {
    errorResponse(res, 418, e);
  });
})

app.get('/game/:gameId', function (req, res) {
  const gameId = req.params.gameId;
  const playerToken = req.headers.token;

  return new Promise(async (resolve, reject) => {
    try {
      const currentPlayer = await getCurrentPlayer(playerToken);

      const currentGame = await getGame(gameId, currentPlayer.id);
      if (!currentGame) {
        reject('no game found');
        return;
      }

      const votes = await getScoreboard(gameId, currentGame.currentFactId);
      let scoreboard = {};
      votes.forEach(vote => {
        scoreboard[vote.votingPlayerId] = vote.votedPlayerId;
      });
      const game = { ...currentGame, scoreboard };

      if (currentGame.status === 'revealed') {
        const fact = await getFactById(currentGame.currentFactId, true);
        const author = await getPlayerById(fact.authorId);
        resolve({
          ...game,
          fact,
          author
        });
        return;
      }

      resolve(game);
    } catch (e) {
      reject(e);
    }
  }).then((game) => {
    happyResponse(res, game);
  }).catch(e => {
    errorResponse(res, 418, e);
  });

});

app.post('/game/:gameId/new-fact', function (req, res) {
  const { gameId } = req.params;
  const { text } = req.body;
  const { token } = req.headers;

  new Promise((resolve, reject) => {
    getCurrentPlayer(token).then(player => {
      createNewFact({
        gameId,
        text,
        authorId: player.id
      }).then(fact => {
        resolve(fact);
      }).catch(e => {
        reject(e);
      });
    }).catch(e => reject(e));
  }).then((fact) => {
    happyResponse(res, fact);
  }).catch(e => errorResponse(res, 418, e));
});

app.post('/game/:gameId/vote', function (req, res) {
  const { gameId } = req.params;
  const { targetPlayerId } = req.body;
  const { token } = req.headers;

  new Promise(async (resolve, reject) => {
    const currentPlayer = await getCurrentPlayer(token);
    const game = await getBaseGame(gameId);
    const voted = await alreadyVoted(gameId, game.currentFactId, currentPlayer.id);
    if (voted) {
      if (voted.votedPlayerId === targetPlayerId) {
        deleteVote(voted.id).then(r => resolve(r)).catch(e => reject(e));
        return;
      }
      updateVote(voted.id, targetPlayerId).then(r => resolve(r)).catch(e => reject(e));
    } else {
      submitVote({
        gameId, selectedFactId: game.currentFactId, votingPlayerId: currentPlayer.id, votedPlayerId: targetPlayerId
      }).then(r => resolve(r)).catch(e => reject(e));
    }
  }).then(() => happyResponse(res, { message: 'Voted' }))
    .catch(e => errorResponse(res, 418, e))
});

app.put('/game/:gameId/start', function (req, res) {
  const gameId = req.body.gameId;
  getRandomFact(gameId).then(async currentFactId => {
    await markFactAsUsed(currentFactId);
    updateGame({
      status: 'inprogress',
      gameId,
      currentFactId
    }).then(() => {
      happyResponse(res, { message: "Round Started!" })
    });
  }).catch(e=>{
    if (e.code==='NO_FACTS'){
      updateGame({
        status: 'standby',
        gameId,
        currentFactId: null
      });
      errorResponse(res, 404, e);
    }
  });
});

app.put('/game/:gameId/reveal', function (req, res) {
  const { gameId } = req.params;

  //TODO getCurrentPlayerId, validate it is host...?

  getGame(gameId).then(game => {
    if (game.status === 'revealed' && game.currentFact?.author) {
      happyResponse(res, game);
      return;
    }
    getFactById(game.currentFactId).then(fact => {
      updateGame({
        status: 'revealed',
        gameId,
        currentFactId: game.currentFactId,
      }).then(async () => {
        const game = await getGame(gameId);
        const votes = await getScoreboard(gameId, game.currentFactId);
        let scoreboard = {};
        votes.forEach(vote => {
          scoreboard[vote.votingPlayerId] = vote.votedPlayerId;
        });

        const idsWinners = game.players.map((player)=>{
          if (player.id === fact.authorId){
            // i am the author, my vote does not count
            return null;
          }
          if (scoreboard[player.id] === fact.authorId){
            return player.id;
          }
        }).filter(p=>p);

        if (idsWinners.length === 0){
          // author wins
          idsWinners.push(fact.authorId);
        }
        idsWinners.forEach(async playerId=>{
          const points = game.players.find(p=>p.id===playerId).points;
          await updatePlayerPoints(playerId, points + 1);
        });

        happyResponse(res, {
          message: 'Round revealed!'
        })
      });
    });
  });
});

app.get('/game/:gameId/player/:playerId', function (req, res) {
  const { gameId } = req.params;
  const playerId = parseInt(req.params.playerId);
  const { token } = req.headers;

  new Promise((resolve, reject) => {
    getCurrentPlayer(token).then((currentPlayer) => {
      if (playerId === currentPlayer.id && gameId === currentPlayer.gameId) {
        resolve(currentPlayer);
        return;
      }

      getPlayerById(gameId, playerId).then(player => {
        resolve(player);
      }).catch(e => reject(e));
    }).catch(e => reject(e));
  }).then(player => {
    happyResponse(res, player);
  }).catch(e => {
    errorResponse(res, 404, e);
  })
});

app.delete('/game/:gameId/fact/:factId', function (req, res){
  const { gameId, factId } = req.params;
  const { token } = req.headers;
  new Promise(async (resolve,reject)=>{
    const player = await getCurrentPlayer(token);
    const fact = await getFactById(factId, true);
    if (fact.authorId === player.id) {
      resolve(await deleteFact(factId));
    }
  }).then(()=>happyResponse(res, { message: 'Fact deleted'})).catch(e=>errorResponse(res,400, {e}));
});



const happyResponse = (res, json) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/json');
  res.json(json);
}

const errorResponse = (res, code, json) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/json');
  res.json(json);
}

const server = app.listen(port, function () {
  const host = server.address().address
  const port = server.address().port
  console.log("Listening at http://%s:%s", host, port)
})