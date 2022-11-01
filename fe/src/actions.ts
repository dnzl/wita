import { CurrentGame, Fact, Player, RegistrationResponse } from "./types";

const hostname = "http://localhost:3500";

export const registerUsername = (
  payload: {
    gameId: string;
    username: string;
  },
  callback: (response: RegistrationResponse) => unknown,
  errorCallback: (error: unknown) => unknown
) => {
  fetch(`${hostname}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then(callback)
    .catch(errorCallback);
};

export const submitFact = (
  gameId: string,
  token: string,
  text: string,
  callback?: (res: Fact) => unknown
) => {
  fetch(`${hostname}/game/${gameId}/new-fact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ text }),
  })
    .then((response) => response.json())
    .then(callback);
};

export const getCurrentGame = (
  gameId: string,
  token: string,
  callback: (data: CurrentGame) => unknown
) => {
  fetch(`${hostname}/game/${gameId}`, {
    headers: { token },
  })
    .then((response) => response.json())
    .then(callback);
};

export const createGame = (
  gameId: string,
  token: string,
  callback: (data: CurrentGame) => unknown
) => {
  fetch(`${hostname}/create-game`, {
    headers: { token },
    body: JSON.stringify({ gameId }),
  })
    .then((response) => response.json())
    .then(callback);
};

export const getPlayer = (
  gameId: string,
  playerId: number,
  token: string,
  callback: (data: Player) => unknown,
  errorCallback: (error: unknown) => unknown
) => {
  fetch(`${hostname}/game/${gameId}/player/${playerId}`, {
    headers: { token },
  })
    .then((response) => {
      if (!response.ok) {
        errorCallback("NO_PLAYER");
        return;
      }
      return response.json();
    })
    .then(callback)
    .catch((e) => errorCallback(e));
};

export const sendVote = (
  gameId: string,
  token: string,
  targetPlayerId: number
) => {
  fetch(`${hostname}/game/${gameId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ targetPlayerId }),
  });
};

export const sendStartGame = async (gameId: string) => {
  return await fetch(`${hostname}/game/${gameId}/start`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  }).then((response) => {
    if (!response.ok) {
      return response.json().then((r) => {
        throw new Error(r.code || "Unknown error");
      });
    }
    return response.json();
  });
};

export const sendRevealGame = (gameId: string) => {
  fetch(`${hostname}/game/${gameId}/reveal`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  });
};

export const deleteFact = (gameId: string, factId: number, token: string) => {
  fetch(`${hostname}/game/${gameId}/fact/${factId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", token },
  });
};
