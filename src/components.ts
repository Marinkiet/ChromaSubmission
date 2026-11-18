/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineComponents } from '@iwsdk/core';
import { HudButton } from './hud-component.js';
import { Robot } from './robot-component.js';
import { Tile } from './tile-component.js';

export default defineComponents([Robot, Tile, HudButton]);
