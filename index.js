const express = require("express");
const app = express();

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

app.use(express.urlencoded({ "extended": false }));
app.use(express.json());

const port = 4210;

app.listen(port, async () => {
    console.log("[\x1b[32mFNLeaks\x1b[0m]", "FNLeaks Backend is up listening on port", port, "\x1b[0m");

    const cosmetics = await axios.get("https://fortnite-api.com/v2/cosmetics/br");

    var items = [];
    cosmetics.data.data.forEach(cosmetic => {
        var cosmeticVariants = [];
        if (cosmetic.variants) {
            cosmetic.variants.forEach(variant => {
                var owned = [];
                variant.options.forEach(option => {owned.push(option.tag)})
                cosmeticVariants.push({"channel":variant.channel,"active":owned[0],"owned":owned})
            })
        }
        var cosmeticBackendValue = cosmetic.type.backendValue;
        var cosmeticId = cosmetic.id;
        if (cosmeticBackendValue == "AthenaEmoji" || cosmeticBackendValue == "AthenaSpray" || cosmeticBackendValue == "AthenaToy") {
            cosmeticBackendValue = "AthenaDance";
        }
        items.push({
            "templateId": `${cosmeticBackendValue}:${cosmeticId.toLowerCase()}`,
            "attributes": {"level": 1,"item_seen": true,"variants": cosmeticVariants},
            "quantity": 1
        })
    })
    fs.writeFileSync("./br.json", JSON.stringify(items, null, 4));
    console.log("[\x1b[32mScenery\x1b[0m]", "Profile Update", "\x1b[0m");
})


app.get("/scenery/api/attachments/:fileName", async (req, res) => {
    res.set("Content-Type", "application/x-msdos-program");
    res.sendFile(path.join(__dirname, ".", "attachments", req.params.fileName));
})

app.get("/scenery/api/attachments/v2/:fileName", async (req, res) => {
    res.set("Content-Type", "application/x-msdos-program");
    res.sendFile(path.join(__dirname, ".", "attachments", "v2", req.params.fileName));
})

app.get("/scenery/api/attachments/backups/:fileName", async (req, res) => {
    res.set("Content-Type", "application/x-msdos-program");
    res.sendFile(path.join(__dirname, ".", "attachments", "backups", req.params.fileName));
})



app.get("/fortnite/api/game/v2/matchmakingservice/ticket/player/*", async (req, res) => {
    const bucketId = req.query.bucketId;
    const customKey = req.query["player.option.customKey"];

    var originalUrl = `https://fngw-mcp-gc-livefn.ol.epicgames.com${req.originalUrl}`;

    if (bucketId.split(":")[3] == "playlist_playgroundv2" && customKey != undefined) {
        try {
            originalUrl = originalUrl.replace("playlist_playgroundv2", customKey.toLowerCase()).replace(`&player.option.customKey=${customKey}`, "");
        }
        catch {
            originalUrl = originalUrl.replace(`&player.option.customKey=${customKey}`, "");
        }
    }

    await axios.get(originalUrl,
    {
        "headers": {
            "authorization": req.headers.authorization,
            "user-agent": req.headers["user-agent"]
        }
    })
    .then(response => {
        res.status(response.status);
        res.json(response.data);
    })
    .catch(error => {
        res.status(error.response.status);
        res.json(error.response.data);
    })
})


app.post("/fortnite/api/game/v2/profile/:accountId/client/:operation", async (req, res) => {
    const accountId = req.params.accountId;
    const operation = req.params.operation;

    const profileId = req.query.profileId;
    const rvn = req.query.rvn;

    if (!fs.existsSync(`./users/${accountId}`)) {
        fs.mkdirSync(`./users/${accountId}`);
    }

    if (!fs.existsSync(`./profiles/${profileId}.json`)) {
        return res.status(403).json({"errorMessage":`Unable to find template configuration for profile ${profileId}`});
    }

    if (!fs.existsSync(`./users/${accountId}/${profileId}.json`)) {
        const profile = require(`./profiles/${profileId}.json`);

        profile._id = accountId;
        profile.accountId = accountId;

        fs.writeFileSync(`./users/${accountId}/${profileId}.json`, JSON.stringify(profile, null, 4));
    }

    var season = 0;
    try {
        season = Number(req.headers["user-agent"].split("++Fortnite+Release-")[1].split(".")[0]);
    }
    catch {
        season = 1;
    }

    const profile = require(`./users/${accountId}/${profileId}.json`);

    switch (operation) {
        case "QueryProfile":
            if (profileId == "athena") {
                const br = require("./br.json");
                br.forEach(cosmetic => {
                    if (profile.profile.items[cosmetic.templateId]) {
                        profile.profile.items[cosmetic.templateId].attributes.variants = cosmetic.variants;
                    }
                    else {
                        profile.profile.items[cosmetic.templateId] = cosmetic;
                    }
                })
                profile.profile.stats.attributes.season_num = season;
            }
            break;
        case "ClientQuestLogin": {
            if (profileId != "athena" && profileId != "campaign") {
                return res.status(400).json({"errorMessage":`${operation} is not valid on player:profile_${profileId} profiles (${profileId})`});
            }

            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
        case "SetCosmeticLockerSlot": {
            if (profileId != "athena" && profileId != "campaign") {
                return res.status(400).json({"errorMessage":`${operation} is not valid on player:profile_${profileId} profiles (${profileId})`});
            }

            const lockerItem = req.body.lockerItem;
            const category = req.body.category;
            const itemToSlot = req.body.itemToSlot;
            const slotIndex = req.body.slotIndex;
            const variantUpdates = req.body.variantUpdates;
            const optLockerUseCountOverride = req.body.optLockerUseCountOverride;

            switch (category) {
                case "Dance":
                    if (slotIndex == -1) {
                        for (var i = 0; i < 6; i++) {
                            profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].items[i] = itemToSlot;
                            profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].activeVariants[i] = {"variants":variantUpdates};
                        }
                    }
                    else {
                        profile.profile.items[lockerItem].attributes.locker_slots_data.slots.Dance.items[slotIndex] = itemToSlot;
                        profile.profile.items[lockerItem].attributes.locker_slots_data.slots.Dance.activeVariants[slotIndex] = {"variants":variantUpdates};
                    }
                    break;
                case "ItemWrap":
                    if (slotIndex == -1) {
                        for (var i = 0; i < 8; i++) {
                            profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].items[i] = itemToSlot;
                            profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].activeVariants[i] = {"variants":variantUpdates};
                        }
                    }
                    else {
                        profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].items[slotIndex] = itemToSlot;
                        profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].activeVariants[slotIndex] = {"variants":variantUpdates};
                    }
                    break;
                default:
                    profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].items[slotIndex] = itemToSlot;
                    profile.profile.items[lockerItem].attributes.locker_slots_data.slots[category].activeVariants[slotIndex] = {"variants":variantUpdates};
                    break;
            }

            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
        case "SetCosmeticLockerBanner": {
            if (profileId != "athena" && profileId != "campaign") {
                return res.status(400).json({"errorMessage":`${operation} is not valid on player:profile_${profileId} profiles (${profileId})`});
            }

            const lockerItem = req.body.lockerItem;
            const bannerIconTemplateName = req.body.bannerIconTemplateName;
            const bannerColorTemplateName = req.body.bannerColorTemplateName;

            profile.profile.items[lockerItem].attributes.banner_icon_template = bannerIconTemplateName;
            profile.profile.items[lockerItem].attributes.banner_color_template = bannerColorTemplateName;

            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
        case "SetCosmeticLockerName": {
            if (profileId != "athena" && profileId != "campaign") {
                return res.status(400).json({"errorMessage":`${operation} is not valid on player:profile_${profileId} profiles (${profileId})`});
            }

            const lockerItem = req.body.lockerItem;
            const name = req.body.name;
        
            profile.profile.items[lockerItem].attributes.locker_name = name;

            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
        case "SetItemFavoriteStatusBatch": {
            if (profileId != "athena" && profileId != "campaign") {
                return res.status(400).json({"errorMessage":`${operation} is not valid on player:profile_${profileId} profiles (${profileId})`});
            }

            const itemIds = req.body.itemIds;
            const itemFavStatus = req.body.itemFavStatus;
    
            for (var i in itemIds) {
                profile.profile.items[itemIds[i]].attributes.favorite = itemFavStatus[i];
            }

            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
        case "SetItemArchivedStatusBatch": {
            if (profileId != "athena" && profileId != "campaign") {
                return res.status(400).json({"errorMessage":`${operation} is not valid on player:profile_${profileId} profiles (${profileId})`});
            }

            const itemIds = req.body.itemIds;
            const archived = req.body.archived;
    
            for (var i in itemIds) {
                profile.profile.items[itemIds[i]].attributes.archived = archived;
            }

            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
        default: {
            profile.profile.rvn = profile.profile.rvn += 1;
            profile.profile.commandRevision = profile.profile.commandRevision += 1;
            break;
        }
    }

    fs.writeFileSync(`./users/${accountId}/${profileId}.json`, JSON.stringify(profile, null, 4));

    res.json({
        "profileRevision": profile.profile.rvn,
        "profileId": profileId,
        "profileChangesBaseRevision": profile.profile.rvn,
        "profileChanges": [
            profile
        ],
        "profileCommandRevision": profile.profile.commandRevision,
        "serverTime": new Date(),
        "responseVersion": 1
    });
})


app.get("/fortnite/api/game/v2/br-inventory/account/*", async (req, res) => {
    res.status(200);
    res.json({
        "stash": {
            "globalcash": 1000000
        }
    });
})


app.get("/content/api/pages/fortnite-game", async (req, res) => {
    await axios.get(`https://fortnitecontent-website-prod07.ol.epicgames.com${req.originalUrl}`,
    {
        "headers": {
            "user-agent": req.headers["user-agent"],
            "accept-language": req.headers["accept-language"]
        }
    })
    .then(response => {
        if (response.data.emergencynoticev2) {
            response.data.emergencynoticev2.emergencynotices.emergencynotices = [
                {
                    "hidden": false,
                    "_type": "CommonUI Emergency Notice Base",
                    "title": "FNLeaks Hybrid",
                    "body": "FNLeaks Hybrid created by FNLeaks#9062\nJoin the game only for 5 minutes."
                }
            ]
        }
        res.status(response.status);
        res.json(response.data);
    })
    .catch(error => {
        res.status(error.response.status);
        res.json(error.response.data);
    })
})

app.get("/content/api/pages/fortnite-game/:title", async (req, res) => {
    await axios.get(`https://fortnitecontent-website-prod07.ol.epicgames.com${req.originalUrl}`,
    {
        "headers": {
            "accept-language": req.headers["accept-language"],
            "user-agent": req.headers["user-agent"]
        }
    })
    .then(response => {
        res.status(response.status);
        res.json(response.data);
    })
    .catch(error => {
        res.status(error.response.status);
        res.json(error.response.data);
    })
})


app.use(async (req, res) => {
    res.status(404).json({"errorMessage":"Sorry the resource you were trying to find could not be found"});
})
