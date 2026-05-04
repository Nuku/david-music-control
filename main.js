import './module/settings.js';
import './module/menu.js';
import './module/token.js';
import './module/party-cluster.js';
import './module/cult.js';
import './module/scene-music.js';
import './module/end-credits.js';
import { migrate } from './module/migrate.js';
import('./module/encounter.js');

Hooks.once('ready', migrate);
