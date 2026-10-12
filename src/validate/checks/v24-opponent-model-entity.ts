// V24: a learned opponent model sits at the path of its entity (observations/opponents/<the
// entity ID's last segment>.json) and is about an entity of this game (the ID's game segment is
// the manifest's game_id), so the engine reads it for the opponent it was learned from.

import { opponentModelPath, type OpponentModel } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';
import { validOutputs } from './engine-outputs.ts';

export const v24OpponentModelEntity: Check = {
  id: 'V24',
  title: '相手モデルのファイルと entity が一致する',
  run: ({ load }) => {
    const gameId = load.bundle.manifest?.doc.game_id;
    const findings: Finding[] = [];
    for (const { path, doc } of validOutputs<OpponentModel>(load, 'opponent-model')) {
      if (opponentModelPath(doc.entity) !== path) findings.push(error(path, '/entity', `${doc.entity} belongs at ${opponentModelPath(doc.entity)}`));
      const game = doc.entity.split(':')[1];
      if (gameId !== undefined && game !== gameId) findings.push(error(path, '/entity', `${doc.entity} is not an entity of ${gameId}`));
    }
    return findings;
  },
};
