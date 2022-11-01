export type Player = {
  id: number;
  token: string;
  username: string;
  points: number;
  gameId: string;
  isWinning?: boolean;
  didVote?: boolean;
  won?: boolean;
  isAuthor?: boolean;
};

export enum GameStatus {
  StandBy = "standby",
  InProgress = "inprogress",
  Revealed = "revealed",
}

export type Fact = {
  id: number;
  text: string;
};

export type Votes = {
  [playerId: number]: number; // player: total votes
};
export type Scoreboard = {
  [playerId: number]: number; // player: total points
};

export type CurrentGame = {
  author?: Player; // only filled when status is "revealed"
  currentFactId?: number;
  currentFact?: Fact;
  myFacts: Fact[];
  gameId: string;
  hostPlayerId: number; // TODO BE should remove from response?
  players: Player[];
  status: GameStatus;
  scoreboard?: Votes;
  totalFacts: number;
};

export type PlayersResponse = {
  players: Player[];
};

export type RegistrationResponse = {
  player: Player;
  game: CurrentGame;
  gameId: string;
};
