// Wire format of the enemy state the server sends to clients.
export interface EnemyState {
  id: string;
  hp: number;
  drop_rate: number;
}

export interface SpawnInfo {
  rngSeed: number;
}
