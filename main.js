import './module/settings.js';
import './module/menu.js';
import './module/token.js';
import { migrate } from './module/migrate.js';
import('./module/encounter.js');

Hooks.once('ready', migrate);
