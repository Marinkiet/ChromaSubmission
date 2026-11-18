/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { HandGestureSystem } from './hand-gestures.js';
import { HudSystem } from './hud.js';
import { InputModeSystem } from './input-mode.js';
import { setupEnvironment } from './environment.js';
import { createTileGrid } from './tile-factory.js';
import { TileInputSystem } from './tile-input.js';
import { TileViewSystem } from './tile-view.js';
import { TrackSystem } from './track-system.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  setupEnvironment(world);
  createTileGrid(world);
  // Order matters: logic first, input next, rendering last.
  world.registerSystem(InputModeSystem);
  world.registerSystem(TrackSystem);
  world.registerSystem(TileInputSystem);
  world.registerSystem(HandGestureSystem);
  world.registerSystem(HudSystem);
  world.registerSystem(TileViewSystem);
});
