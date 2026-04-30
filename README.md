# Foundry VTT - 🎹 David Music Control

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Nuku/david-music-control)
![GitHub Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/latest/pf2-david-music-control.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/pf2-david-music-control.zip?label=downloads)

Control your battle music! Automatically play songs amongst your combat playlists when combat starts.

## How does it work?

Everytime combat starts the module checks for the highest priority playlist for the encounter, with this simple rules:

-   All Combat Playlists have priority zero
-   The default playlist, if set, has priority 1
-   Every token can have their own associated playlist or music with a set priority, this means every token can affect the music played
-   You can override everything by configuring a music for the encounter

## Installation

In the setup screen, use the manifest URL https://raw.githubusercontent.com/Nuku/david-music-control/main/module.json to install the module.

## How to Use

First things first! Let's start by configuring the module, so the module knows what playlists are your _Combat Playlists_.

There is a new button in the encounter tracker for overring the battle music for a specific encounter.

In the **Token Configuration** application there is a new button on the header called **Combat Music**, using that application you can configure specific music configurations related to that specific token.

For PF2e party actors, the **Token Configuration** application also has a **Cluster Party** button. It builds a single crowd-style image from the party members' token images, saves it in the world folder, and sets it as the party actor and token image.

GMs can enable the **PF2e Cult System** module setting to add a **Cult** tab to PF2e party sheets. The tab tracks the cult's level, Fervor Points, Recruitment Points, Mythic Points, mantles, activities, and phase notes. Players can view the cult and roll its level check from the tab; GMs can edit the stored values directly.
