import './module/settings.js';
import './module/menu.js';
import './module/token.js';
import './module/party-cluster.js';
import './module/scene-music.js';
import './module/auto-walls.js';
import { migrate } from './module/migrate.js';
import('./module/encounter.js');

Hooks.once('ready', migrate);
