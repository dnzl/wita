import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUsername, getPlayer, createGame } from "../actions";

export default function HomePage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [gameId, setGameId] = useState("");

  const doRegister = useCallback(
    () =>
      registerUsername(
        { username, gameId },
        ({ player, game }) => {
          if (!player?.token) {
            console.log("Error: no token");
            return;
          }
          localStorage.setItem("player", JSON.stringify(player));
          if (game) {
            navigate(`game/${gameId}`);
            return;
          }
          createGame(gameId, player.token, (game) => {
            navigate(`game/${gameId}`);
          });
        },
        (error) => {
          console.error(error);
        }
      ),
    [username, gameId, navigate]
  );

  const joinGame: React.FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault();
      const localPlayer = JSON.parse(localStorage.getItem("player") || "{}");

      if (!localPlayer || !localPlayer.token || !localPlayer.gameId) {
        // player does not exist, register player
        doRegister();
        return;
      }
      if (gameId !== localPlayer.gameId || username !== localPlayer.username) {
        // different player
        doRegister();
        return;
      }
      getPlayer(
        localPlayer.gameId,
        localPlayer.id,
        localPlayer.token,
        (player) => {
          if (!player || !player.gameId) {
            console.error("Unknown error obtaining player");
            return;
          }
          navigate(`game/${player.gameId}`);
        },
        (error) => {
          if (error === "NO_PLAYER") {
            doRegister();
          }
        }
      );
      return;
    },
    [navigate, username, gameId, doRegister]
  );

  const updateUsername: React.ChangeEventHandler<HTMLInputElement> =
    useCallback((e) => {
      e.preventDefault();
      setUsername(e.currentTarget.value);
    }, []);
  const updateGameId: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      e.preventDefault();
      setGameId(e.currentTarget.value);
    },
    []
  );

  React.useEffect(() => {
    const player = JSON.parse(localStorage.getItem("player") || "{}");
    setUsername(player?.username || "");
    setGameId(player?.gameId || "");
  }, []);

  return (
    <div className="home">
      <form onSubmit={joinGame}>
        <input
          name="username"
          className="txt"
          placeholder="Insert your username"
          value={username}
          onChange={updateUsername}
          autoFocus
        />
        <input
          name="gameId"
          value={gameId}
          className="txt"
          placeholder="Insert game ID"
          onChange={updateGameId}
          pattern="[a-zA-Z0-9]+"
        />
        <button className="btn" type="submit">
          Join game
        </button>
      </form>
    </div>
  );
}
