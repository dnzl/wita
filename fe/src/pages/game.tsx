import React, { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteFact,
  getCurrentGame,
  sendRevealGame,
  sendStartGame,
  sendVote,
  submitFact,
} from "../actions";
import { CurrentGame, Fact, GameStatus, Player, Scoreboard } from "../types";

export default function Game() {
  const params = useParams();
  const gameId = params.id || "RubberDucksGameNight";

  const [currentAuthor, setCurrentAuthor] = useState<Player>();

  const [currentPlayer, setCurrentPlayer] = useState<Player>();
  const [isHost, setIsHost] = useState(false);

  const [gameStatus, setGameStatus] = useState(GameStatus.StandBy);

  const [players, setPlayers] = useState<Player[]>([]);
  const [votedPlayer, setVotedPlayer] = useState<Player | null>(null);
  const [newFact, setNewFact] = useState("");
  const [myFacts, setMyFacts] = useState<Fact[]>([]);
  const [totalFacts, setTotalFacts] = useState(0);
  const [currentFact, setCurrentFact] = useState<Fact>();
  const [scoreboard, setScoreboard] = useState<Scoreboard>();

  const navigate = useNavigate();
  const intervalLength = 2000;

  React.useEffect(() => {
    const local: Player = JSON.parse(localStorage.getItem("player") || "{}");
    if (!local.token) {
      navigate("/");
    }
    if (!currentPlayer || local?.id !== currentPlayer?.id) {
      setCurrentPlayer(local);
    }
  }, [currentPlayer, setCurrentPlayer, navigate]);

  React.useEffect(() => {
    console.log("effect: start game", { currentPlayer });
    if (!currentPlayer?.token) {
      return;
    }
    const interval = setInterval(() => {
      getCurrentGame(gameId, currentPlayer.token, (game: CurrentGame) => {
        setGameStatus(game.status);

        let winner: Player | null = game.players.sort((a, b) =>
          a.points > b.points ? -1 : 1
        )[0];

        if (winner.points <= 0) {
          winner = null;
        }

        const players = game.players.map<Player>((player) => {
          const didVote = !!game.scoreboard?.[player.id];
          const won =
            game.status === GameStatus.Revealed &&
            game.scoreboard?.[player.id] === game.author?.id;
          const isWinning = winner?.id === player.id;
          const isAuthor =
            game.status === GameStatus.Revealed &&
            game.author?.id === player.id;

          return {
            ...player,
            didVote,
            isWinning,
            isAuthor,
            won,
          };
        });

        setPlayers(players);
        setMyFacts(game.myFacts);
        setIsHost(currentPlayer.id === game.hostPlayerId); // TODO should be handled by BE

        const votedPlayerId = game.scoreboard?.[currentPlayer.id];
        const votedPlayer =
          game.players?.find((p) => p.id === votedPlayerId) || null;
        setVotedPlayer(votedPlayer);
        setScoreboard(game.scoreboard);

        setTotalFacts(game.totalFacts);
        setCurrentFact(game.currentFact);
        if (game.status === GameStatus.Revealed && game.author?.id) {
          setCurrentAuthor(game.author);
        }
      });
    }, intervalLength);
    return () => clearInterval(interval);
  }, [params.id, gameId, currentPlayer]);

  const voteForPlayer = useCallback(
    (player?: Player) => {
      if (!currentPlayer?.id || !player?.id) {
        return;
      }
      sendVote(gameId, currentPlayer.token, player.id);
    },
    [gameId, currentPlayer]
  );

  const addFact: React.FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault();
      if (!currentPlayer || !currentPlayer.id) {
        return;
      }

      submitFact(gameId, currentPlayer.token, newFact);
      e.currentTarget.reset();
    },
    [newFact, currentPlayer, gameId]
  );

  const updateFactValue: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setNewFact(e.currentTarget.value);
  };

  const removeFact = useCallback(
    (id: number) => {
      if (!currentPlayer?.token) {
        console.error("Error: no player found", { currentPlayer });
        return;
      }
      deleteFact(gameId, id, currentPlayer.token);
    },
    [gameId, currentPlayer]
  );

  const getPlayerEmoji = (player: Player) => {
    let emoji = "";
    if (gameStatus === GameStatus.Revealed) {
      if (player.isAuthor) {
        emoji = "😈";
      } else {
        if (player.won) {
          emoji = "🎉";
        } else {
          emoji = "😵";
        }
      }
    }

    return emoji;
  };
  const getVotedFor = (player: Player) => {
    const votedPlayerId = scoreboard?.[player.id];
    const votedPlayer = players?.find((p) => p.id === votedPlayerId) || null;
    if (gameStatus === GameStatus.Revealed) {
      return <>voted for: {votedPlayer?.username || " - "}</>;
    }
    return null;
  };

  const isMe = useCallback(
    (player: Player) => {
      return player.id === currentPlayer?.id;
    },
    [currentPlayer]
  );

  const renderGameInProgress = () => {
    return (
      <div className="pills">
        {players.map((p, i) => (
          <button
            key={i}
            className={votedPlayer?.id === p.id ? "selected" : ""}
            onClick={() => voteForPlayer(p)}
          >
            {p.username}
          </button>
        ))}
      </div>
    );
  };

  const startGame = () => {
    sendStartGame(gameId).catch((e) => {
      console.error(`Cannot start game`, { e });
      alert("Game cant be started, do you have enough facts?");
    });
  };
  const revealAuthor = () => {
    sendRevealGame(gameId);
  };

  return (
    <div className="game">
      <aside>
        <section>
          <h3>Total facts: {totalFacts}</h3>
        </section>
        <section>
          <h3>Players</h3>
          <ul className="player-list">
            {players.map((p, i) => {
              const classNames = ["player"];
              p.isWinning && classNames.push("winning");
              isMe(p) && classNames.push("me");

              return (
                <li key={i} className={classNames.join(" ")}>
                  <span className="winning-status">
                    {(p.isWinning && "👑") || " "}
                  </span>
                  <span className="name">
                    {p.username}{" "}
                    <span className="voted-for">
                      {" "}
                      {getVotedFor(p)} {getPlayerEmoji(p)}
                    </span>
                  </span>
                  <span className="points">{p.points} pts</span>
                  <span className="voting-status">
                    {gameStatus !== GameStatus.StandBy &&
                      ((p.didVote && "✔️") || "💬")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        {isHost && (
          <div className="host-options">
            {gameStatus === GameStatus.StandBy && (
              <button className="btn" onClick={startGame}>
                Start Game
              </button>
            )}
            {gameStatus === GameStatus.InProgress && (
              <button className="btn" onClick={revealAuthor}>
                Reveal author
              </button>
            )}
            {gameStatus === GameStatus.Revealed && (
              <button className="btn" onClick={startGame}>
                Start new round
              </button>
            )}
          </div>
        )}
      </aside>
      <section className="main">
        <header>
          <h2>Welcome to {params.id}!</h2>
        </header>
        <div>
          {gameStatus !== GameStatus.StandBy && (
            <>
              <p>Currently guessing:</p>
              <q>{currentFact?.text}</q>
            </>
          )}
          {gameStatus === GameStatus.InProgress && renderGameInProgress()}
          {gameStatus === GameStatus.Revealed && (
            <div className="reveal">~ {currentAuthor?.username} ~</div>
          )}
          {gameStatus === GameStatus.StandBy && (
            <div className="stand-by">
              <p>Waiting for the host to start the game.</p>
              <p>Meanwhile, submit your facts!</p>
            </div>
          )}
        </div>
        <div className="facts-form">
          <form onSubmit={addFact} autoComplete="off">
            <input
              className="txt"
              name="fact"
              placeholder="Write a fact about yourself..."
              onChange={updateFactValue}
              autoFocus
            />
            <button
              type="submit"
              className="btn"
              disabled={newFact.length === 0}
            >
              Add fact
            </button>
          </form>
        </div>
        <div className="my-facts">
          <h4>My facts</h4>
          <ul>
            {(myFacts?.length &&
              myFacts.map((f, i) => (
                <li key={i}>
                  <>
                    {f.text}{" "}
                    <button onClick={() => removeFact(f.id)}>delete</button>
                  </>
                </li>
              ))) || <>Create a new fact in the input above</>}
          </ul>
        </div>
      </section>
    </div>
  );
}
