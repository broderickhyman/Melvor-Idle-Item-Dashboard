declare interface Window {
  dashboard: ItemDashboard;
}

class Options {
  public pointTracked: SnapshotKeys | "";
  public itemTracked: string;
  public intervalTracked: number;
  public trackIntervals: any;
  public blacklistMode: boolean;
  public blacklistItems: any;

  constructor() {
    this.pointTracked = "";
    this.itemTracked = "";
    this.intervalTracked = 1;
    this.trackIntervals = [
      [0, 'reset'],
      [1, 'sec'],
      [60, 'min'],
      [3600, 'hour'],
      [3600 * 24, 'day']
    ];
    this.blacklistMode = false;
    this.blacklistItems = {};

    let localCopy = this.LoadOptions();
    if (localCopy !== null) {
      console.log("Found MIIDOptions")
      const savedOptions = JSON.parse(localCopy) as Options;
      this.pointTracked = savedOptions.pointTracked;
      this.itemTracked = savedOptions.itemTracked;
      this.intervalTracked = savedOptions.intervalTracked;
      this.blacklistMode = savedOptions.blacklistMode;
      this.blacklistItems = savedOptions.blacklistItems;
    }
  }

  private LoadOptions() {
    return localStorage.getItem("MIIDOptions-" + currentCharacter);
  }
}

interface SnapshotOptions {
  prayerPoints: number;
  slayerCoins: number;
  gp: number;
  hp: number;
  kills: number;
}

class Snapshot implements SnapshotOptions {
  public date: number;
  public bulkItems: { [name: string]: number };
  // public skills: allXP(),
  public prayerPoints: number;
  public slayerCoins: number;
  public gp: number;
  public hp: number;
  public kills: number;

  constructor() {
    this.date = 0;
    this.bulkItems = {};
    this.prayerPoints = 0;
    this.slayerCoins = 0;
    this.gp = 0;
    this.hp = 0;
    this.kills = 0;
  }

  //getProperty<K extends keyof Snapshot>(key: K) {
  //  return this[key]; // Inferred type is T[K]
  //}
  //setProperty<K extends keyof Snapshot>(key: K, value: Snapshot[K]) {
  //  this[key] = value;
  //}
}

type SnapshotKeys = keyof SnapshotOptions;

class ItemDashboard {
  public options: Options;
  itemTracker: {
    start: Snapshot;
    curr: Snapshot;
  };
  resDiff: {
    rateFactor: number;
    netWealthRate: number;
    netWealthChange: number;
    timePassed: number;
    intervalDur: number;
    intervalLabel: string;
    itemChange: { [name: string]: number };
    worthChange: { [name: string]: number };
    itemRate: { [name: string]: number };
    worthRate: { [name: string]: number };
    itemRound: number;
    goldRound: number;
    generalItemRate: number;
    generalItemChange: number;
    generalWorthChange: number;
    generalWorthRate: number;
    generalChanges: boolean;
    farmingItemRate: number;
    farmingItemChange: number;
    farmingWorthChange: number;
    farmingWorthRate: number;
    farmingChanges: boolean;
    totalWorthChange: number;
    totalWorthRate: number;
    pointChange: { [name: string]: number };
    pointRate: { [name: string]: number };
    pointTimeLeft: { [name: string]: number };
    pointChanges: boolean;
    xpChange: any[];
    xpRate: any[];
    poolChange: any[];
    poolRate: any[];
    poolPercChange: any[];
    poolPercRate: any[];
    masteryChange: any[];
    masteryRate: any[];
    skillChanges: boolean;
    lossChanges: boolean;
    timeLeft: { [name: string]: number };
  };

  constructor() {
    this.options = new Options();
    this.itemTracker = {
      start: this.getSnapshot(),
      curr: this.getSnapshot(),
    };
    this.resDiff = {
      rateFactor: 0,
      netWealthRate: 0,
      netWealthChange: 0,
      timePassed: 0,
      intervalDur: -1,
      intervalLabel: "default",
      itemChange: {},
      worthChange: {},
      itemRate: {},
      worthRate: {},
      itemRound: 2,
      goldRound: 0,

      generalItemRate: 0,
      generalItemChange: 0,
      generalWorthChange: 0,
      generalWorthRate: 0,
      generalChanges: false,

      farmingItemRate: 0,
      farmingItemChange: 0,
      farmingWorthChange: 0,
      farmingWorthRate: 0,
      farmingChanges: false,

      totalWorthChange: 0,
      totalWorthRate: 0,

      pointChange: {},
      pointRate: {},
      pointTimeLeft: {},
      pointChanges: false,

      xpChange: new Array(game.skills.allObjects.length).fill(0),
      xpRate: new Array(game.skills.allObjects.length).fill(0),
      poolChange: new Array(game.skills.allObjects.length).fill(0),
      poolRate: new Array(game.skills.allObjects.length).fill(0),
      poolPercChange: new Array(game.skills.allObjects.length).fill(0),
      poolPercRate: new Array(game.skills.allObjects.length).fill(0),
      masteryChange: new Array(game.skills.allObjects.length).fill(0),
      masteryRate: new Array(game.skills.allObjects.length).fill(0),
      skillChanges: false,

      lossChanges: false,
      timeLeft: {},
    };
  }

  itemsOwned(silent = true) {
    function EnsureItem(bulk: { [name: string]: number }, id: string) {
      if (!bulk[id]) {
        bulk[id] = 0;
      }
    }

    let bulk: { [name: string]: number } = {};
    // take everything in bank, pile it here
    for (let bankTab of game.bank.itemsByTab) {
      for (let bankSlot of bankTab) {
        let itemID = bankSlot.item.id;
        EnsureItem(bulk, itemID);
        bulk[itemID] += bankSlot.quantity;
      }
    }

    // check equipment sets, ignore golbin loadout
    for (let equipmentSet of game.combat.player.equipmentSets) {
      let slotArray = equipmentSet.equipment.slotArray;
      for (let slot of slotArray) {
        let gearID = slot.item.id;
        EnsureItem(bulk, gearID);
        let qty = slot.quantity;
        if (gearID) {
          bulk[gearID] += qty;
          !silent && console.log(`gear item:${slot.item.name} qty ${qty}`)
        }
      }
    }
    // tally food, ignore golbin food at equippedFood[3]
    for (let foodSlot of game.combat.player.food.slots) {
      let foodID = foodSlot.item.id;
      EnsureItem(bulk, foodID);
      let qty = foodSlot.quantity;
      if (qty > 0) {
        !silent && console.log(`food item:${foodSlot.item.name} qty ${qty}`);
        bulk[foodID] += qty;
      }
    }

    if (!silent) {
      for (let itemId in bulk) {
        let itemData = game.items.getObjectByID(itemId);
        if (itemData) {
          console.log(`has item:${itemData.name} qty ${bulk[itemId]}`);
        }
      }
    }
    return bulk;
  }

  AutoEatEfficiency() {
    const percent = game.combat.player.modifiers.increasedAutoEatEfficiency - game.combat.player.modifiers.decreasedAutoEatEfficiency;
    return Math.max(percent, 1);
  }

  effHp() {
    let foodObj = game.combat.player.food.currentSlot;
    let calcFoodQty = foodObj.quantity * (1 + game.combat.player.modifiers.increasedChanceToPreserveFood);
    let healValue = Math.floor(game.combat.player.getFoodHealing(foodObj.item) * this.AutoEatEfficiency() / 100);
    let hp = game.combat.player.hitpoints;
    if (calcFoodQty == 0)
      return hp;
    else
      return hp + calcFoodQty * healValue;
  }

  totalKills() {
    let kills = 0;
    for (let monster of game.monsters.allObjects) {
      kills += game.stats.monsterKillCount(monster) || 0;
    }
    return kills;
  }

  toggleIntervalSize() {
    if (this.options.itemTracked !== "") {
      this.options.itemTracked = "";
      this.options.intervalTracked = 0;
    }
    this.options.intervalTracked = (this.options.intervalTracked + 1) % this.options.trackIntervals.length;
  }

  getTimeString(sec: number) {
    let s = Math.round(sec)
    let h = Math.floor(s / 3600)
    let m = Math.floor((s - h * 3600) / 60)
    s = s - 3600 * h - 60 * m;
    // if (h == 0) {
    //     if (m == 0) {
    //         return `${s}s`;
    //     } else return `${m}m${s}s`;
    // } else return `${h}h${m}m${s}s`;
    // let timeString = ` h: ${h} m: ${m} s: ${s}`;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }


  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////         XP            //////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////

  // levelToXp = function(level) {
  //     let xp = 0;
  //     for (let l = 1; l <= level - 1; l++) {
  //         xp += Math.floor(l + 300 * Math.pow(2, l / 7))
  //     }
  //     return Math.floor(xp / 4);
  // }

  // levels = []
  // for (let i = 0; i < 200; i++) {
  //     levels[i] = levelToXp(i)
  // }

  // xpToLevel = function(xp) {
  //     let level = 1;
  //     while (levels[level + 1] <= xp) level++;
  //     return level;
  // }


  // window.idToSkillname = {};
  // // number to name
  // for (let key of Object.keys(CONSTANTS.skill)) {
  //     idToSkillname[CONSTANTS.skill[key]] = key
  // }
  // // console.log(idToSkillname)

  // window.allXP = function(loud = false) {
  //     let skills = [];
  //     let allSkills = game.skills.allObjects;
  //     for (let i = 0; i < allSkills.length; i++) {
  //         let currentSkill = allSkills[i];
  //         skills[i] = {
  //             name: currentSkill.name,
  //             xp: currentSkill.xp,
  //             level: xpToLevel(currentSkill),
  //         }
  //         skills[i].xpToNext = levelToXp(skills[i].level + 1) - currentSkill;
  //         loud && console.log("skill", i, skills[i].name)
  //         if (currentSkill.hasMastery) {
  //             skills[i].pool = currentSkill.masteryPoolXP;
  //             skills[i].mastery = MASTERY[i].xp.reduce((a, b) => a + b);
  //             skills[i].poolMax = currentSkill.masteryPoolCap;
  //             skills[i].poolPerc = currentSkill.masteryPoolProgress;
  //         }
  //     }
  //     return skills;
  // }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////      SNAPSHOTS        //////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////

  // let itemTracker = {
  //     start: {
  //         bulkItems: [
  //             0: 34,
  //             1: 356
  //         ],
  //         gp: 2444,
  //         prayerPoints: 54243,
  //     },
  //     curr: {... }
  getSnapshot() {
    let resources = {
      date: (new Date()).getTime(),
      bulkItems: this.itemsOwned(),
      // skills: allXP(),
      prayerPoints: game.combat.player.prayerPoints,
      slayerCoins: game.slayerCoins.amount,
      gp: game.gp.amount,
      hp: this.effHp(),
      kills: this.totalKills(),
    };
    return resources;
  }

  resetItemTracker() {
    this.itemTracker = {
      start: this.getSnapshot(),
      curr: this.getSnapshot(),
    }
    this.trackerTick();
  }


  // resetItemTracker();

  setupItemTracker() {
    let localCopy = localStorage.getItem("itemTracker-" + currentCharacter)
    if (localCopy == null) {
      this.resetItemTracker();
    } else {
      this.itemTracker = JSON.parse(localCopy);
    }
  }

  roundCustom(nr: number, roundDigits = 0, letters = true) {
    // 12345.6789 --> roundDecs:
    // 12345
    if (Math.abs(nr) < 1000 || !letters) {
      return Math.round(nr * Math.pow(10, roundDigits)) / Math.pow(10, roundDigits);
    } else if (Math.abs(nr) < 1000000) {
      // 32415 -> 32.4k
      return Math.round(nr / (Math.pow(10, 3 - roundDigits))) / Math.pow(10, roundDigits) + "k";
    } else {
      // 12345678 -> 12.3m
      return Math.round(nr / (Math.pow(10, 6 - roundDigits))) / Math.pow(10, roundDigits) + "m";
    }
  }

  setItemTracked(itemID: string) {
    this.options.itemTracked = itemID;
  }

  trackerTick(silent = true) {
    this.itemTracker.curr = this.getSnapshot();
    let { start, curr } = this.itemTracker;
    let timePassed = (curr.date - start.date) / 1000;
    // save tracker
    localStorage.setItem("itemTracker-" + currentCharacter, JSON.stringify(this.itemTracker));
    localStorage.setItem("MIIDOptions-" + currentCharacter, JSON.stringify(this.options));



    // !silent && console.log(`xp change: ${resDiff.xpChange}, game.skills.allObjects.length: ${game.skills.allObjects.length}`)
    let rateFactor = 1;
    const itemTracked = this.options.itemTracked;
    if (itemTracked == "") {
      // time-based tracking
      let interval = this.options.trackIntervals[this.options.intervalTracked];
      this.resDiff.intervalDur = interval[0];
      this.resDiff.intervalLabel = interval[1];
      if (this.resDiff.intervalDur == 0) {
        rateFactor = 1;
      } else {
        rateFactor = timePassed / this.resDiff.intervalDur;
      }
    } else {
      if (!this.options.itemTracked) {
        // point tracking
        if (this.options.pointTracked) {
          const snapshotKey = this.options.pointTracked;
          rateFactor = curr[snapshotKey] - start[snapshotKey];
          this.resDiff.intervalLabel = this.options.itemTracked;
        } else {
          console.log(`Error tracking by ${this.options.itemTracked}`);
        }
      } else {
        // track relative to a specific item's change
        rateFactor = this.itemTracker.curr.bulkItems[this.options.itemTracked] -
          this.itemTracker.start.bulkItems[this.options.itemTracked]

        let itemData = game.items.getObjectByID(this.options.itemTracked);
        if (itemData) {
          this.resDiff.intervalLabel = itemData.name;
        }
        !silent && console.log(`Tracking by ${this.options.itemTracked}`)
      }
    }

    // items
    for (let itemIndex = 0; itemIndex < game.items.allObjects.length; itemIndex++) {
      let itemData = game.items.allObjects[itemIndex];
      let itemID = itemData.id;
      let startQty = start.bulkItems[itemID] || 0;
      let currQty = curr.bulkItems[itemID] || 0;
      let change = currQty - startQty;
      if (change == 0) continue;

      // absolute change, interval rate, time left
      this.resDiff.itemChange[itemID] = change;
      this.resDiff.itemRate[itemID] = change / rateFactor;

      // register change
      !silent && console.log(`${itemData.name} changed by ${this.resDiff.itemRate[itemID]} / ${this.resDiff.intervalLabel}`);
      let worthChange = change * itemData.sellsFor;
      this.resDiff.worthChange[itemID] = worthChange;
      this.resDiff.worthRate[itemID] = worthChange / rateFactor;
      // split by farming
      // I miss you horsie
      // Daisy, where are you now
      if (itemData.category == "Farming") {
        this.resDiff.farmingChanges = true;
        this.resDiff.farmingItemChange += change;
        this.resDiff.farmingWorthChange += worthChange;
      } else {
        this.resDiff.generalChanges = true;
        this.resDiff.generalItemChange += change;
        this.resDiff.generalWorthChange += worthChange;
      }
      if (change < 0 && currQty > 0) {
        this.resDiff.lossChanges = true;
        let timeLeft = currQty / (-change / timePassed);
        this.resDiff.timeLeft[itemID] = timeLeft;
        !silent && console.log(`${itemData.name} running out in ${this.resDiff.timeLeft[itemID]}`);
      }
    }
    this.resDiff.generalItemRate = this.resDiff.generalItemChange / rateFactor;
    this.resDiff.generalWorthRate = this.resDiff.generalWorthChange / rateFactor;

    this.resDiff.farmingItemRate = this.resDiff.farmingItemChange / rateFactor;
    this.resDiff.farmingWorthRate = this.resDiff.farmingWorthChange / rateFactor;

    this.resDiff.totalWorthChange = this.resDiff.generalWorthChange + this.resDiff.farmingWorthChange;
    this.resDiff.totalWorthRate = this.resDiff.totalWorthChange / rateFactor;

    this.resDiff.netWealthChange = this.resDiff.totalWorthChange + curr.gp - start.gp;
    this.resDiff.netWealthRate = (this.resDiff.totalWorthChange + curr.gp - start.gp) / rateFactor;
    // points
    let pointNames = ["gp", "prayerPoints", "slayerCoins", "hp", "kills"];
    let trackTimeLeft: { [name: string]: boolean } = { "prayerPoints": true, "hp": true };
    for (let pointName of pointNames) {
      let snapshotKey = pointName as SnapshotKeys;
      let startQty = start[snapshotKey];
      let currQty = curr[snapshotKey];
      let change = currQty - startQty;
      let rate = change / rateFactor;
      this.resDiff.pointRate[pointName] = rate;
      this.resDiff.pointChange[pointName] = change;
      if (!silent && change != 0) console.log(pointName, " differ by", rate, "/", this.resDiff.intervalLabel);
      if (currQty > 0 && change < 0 && trackTimeLeft[pointName]) {
        let timeLeft = currQty / (-change / timePassed);
        this.resDiff.pointTimeLeft[pointName] = timeLeft;
        !silent && console.log(`${pointName} point running out in ${this.resDiff.pointTimeLeft[pointName]}`);
      }
    }

    // XP
    //     for (let skillID = 0; skillID < game.skills.allObjects.length; skillID++) {
    //         this.resDiff.xpChange[skillID] = itemTracker.curr.skills[skillID].xp - start.skills[skillID].xp;
    //         this.resDiff.xpRate[skillID] = this.resDiff.xpChange[skillID] / rateFactor

    //         this.resDiff.poolPercChange[skillID] = itemTracker.curr.skills[skillID].poolPerc - start.skills[skillID].poolPerc;
    //         this.resDiff.poolPercRate[skillID] = this.resDiff.poolPercChange[skillID] / rateFactor;

    //         this.resDiff.poolChange[skillID] = itemTracker.curr.skills[skillID].pool - start.skills[skillID].pool;
    //         this.resDiff.poolRate[skillID] = this.resDiff.poolChange[skillID] / rateFactor;

    //         this.resDiff.masteryChange[skillID] = itemTracker.curr.skills[skillID].mastery - start.skills[skillID].mastery;
    //         this.resDiff.masteryRate[skillID] = this.resDiff.masteryChange[skillID] / rateFactor;
    //     }

    this.resDiff.rateFactor = rateFactor;
    // glove charges (todo)
    if (document.getElementById("dashWealthChange") != null) {
      $("#dashWealthChange").text(`${this.roundCustom(this.resDiff.netWealthRate, 0)}/${this.resDiff.intervalLabel}`);
    }
    return this.resDiff;
  }

  handleItemClick(itemID: string) {
    if (this.options.blacklistMode) {
      if (this.options.blacklistItems[itemID]) {
        this.options.blacklistItems[itemID] = false;
      } else {
        this.options.blacklistItems[itemID] = true;
      }
    } else {
      this.setItemTracked(itemID);
    }
    this.updateDash();
  }

  getDashContent() {
    let compact = $(window).width() as number < 1250;
    // use curr and start to generate some item rows, and change #dashItems for it
    let generalContent = ``
    let farmingContent = ``;
    let lossContent = ``;
    let pointContent = ``;
    let xpContent = ``;
    let content = ``;

    // each item row
    for (let itemIndex = 0; itemIndex < game.items.allObjects.length; itemIndex++) {
      let itemData = game.items.allObjects[itemIndex];
      let itemID = itemData.id;
      if (this.options.blacklistItems[itemID] && !this.options.blacklistMode) continue;
      let change = this.resDiff.itemChange[itemID];

      // each item's change, put in the right content chunk
      // display if change is nonzero or blacklisted item in blacklist mode
      if ((change !== undefined && change !== 0) || (this.options.blacklistItems[itemID] && this.options.blacklistMode)) {
        let itemRate = this.roundCustom(this.resDiff.itemRate[itemID], this.resDiff.itemRound);
        let worthRate = this.roundCustom(this.resDiff.worthRate[itemID], this.resDiff.goldRound);
        let banned = this.options.blacklistItems[itemID];
        let row;
        // create item row
        if (compact) {
          row = `
                <div class="pointer-enabled" onClick="window.dashboard.handleItemClick('${itemID}')">
                    <img width="32" height="32" src="${itemData.media}"></img>
                    <span>
                        ${banned ? String(itemRate).strike() : itemRate}
                    </span>
                    <br>
                </div`;
        } else {
          row = `
                <div class="row">
                    <div class="col-4 pointer-enabled" onClick="window.dashboard.handleItemClick('${itemID}')">
                        <img class="nav-img" src="${itemData.media}"></img>
                        ${banned ? itemData.name.strike() : itemData.name}
                    </div>
                    <div class="col-4">${banned ? String(itemRate).strike() : itemRate}</div>
                    <div class="col-4">
                        <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
                        ${banned ? String(worthRate).strike() : worthRate}
                    </div>
                </div>`;
        }
        if (itemData.category == "Farming") {
          farmingContent += row;
        } else {
          generalContent += row;
        }
        // Items running out --> lossContent
        // add row to loss content
        if (this.resDiff.timeLeft[itemID] > 0) {
          let timeString = this.getTimeString(this.resDiff.timeLeft[itemID]);
          let lossRow = ``;
          if (compact) {
            lossRow = `
                    <div class="pointer-enabled" onClick="window.dashboard.handleItemClick('${itemID}')">
                        <img width="32" height="32" src="${itemData.media}"></img>
                        <span>
                            ${timeString} left
                        </span>
                        <br>
                    </div`;
          } else {
            lossRow = `
                    <div class="row pointer-enabled" onClick="window.dashboard.handleItemClick('${itemID}')">
                        <div class="col-6">
                            <img class="nav-img" src="${itemData.media}"></img>
                            ${this.roundCustom(this.itemTracker.curr.bulkItems[itemID], 1)}
                        </div>
                        <div class="col-6">${timeString} left</div>
                    </div>`;
          }
          lossContent += lossRow;
        }
      }
    }
    // assemble general, farming, loss content with headers
    if (compact) {
      generalContent = `
            <br>
            <div class = "row no-gutters">
                <h5 class = "font-w700 text-center text-combat-smoke col"> General items </h5>
            </div>` + generalContent;
      farmingContent = `
            <br>
            <div class = "row no-gutters">
                <h5 class = "font-w700 text-center text-combat-smoke col"> Farming items </h5>
            </div>` + farmingContent;
      lossContent = `
            <br>
            <div class = "row no-gutters">
                <h5 class = "font-w700 text-center text-combat-smoke col"> Items being used </h5>
            </div>` + lossContent;
    } else {
      generalContent = `
            <br>
            <div class = "row no-gutters">
                <h5 class = "font-w700 text-center text-combat-smoke col"> General items </h5>
                <h5 class = "font-w700 text-center text-combat-smoke col"> Change </h5>
                <h5 class = "font-w700 text-center text-combat-smoke col"> Gold Worth </h5>
            </div>` + generalContent;
      farmingContent = `
            <br>
            <div class = "row no-gutters">
                <h5 class = "font-w700 text-center text-combat-smoke col"> Farming items </h5>
                <h5 class = "font-w700 text-center text-combat-smoke col"> Change </h5>
                <h5 class = "font-w700 text-center text-combat-smoke col"> Gold Worth </h5>
            </div>` + farmingContent;
      lossContent = `
                <br>
                <div class = "row no-gutters">
                    <h5 class = "font-w700 text-center text-combat-smoke col"> Items in use </h5>
                    <h5 class = "font-w700 text-center text-combat-smoke col"> Time left </h5>
                </div>` + lossContent;
    }
    // item category rate and worth rate
    if (compact) {
      generalContent += `
        <br>
        <h5> General items </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/main/bank_header.svg"></img>
        <br>
        <span>${this.roundCustom(this.resDiff.generalItemRate, this.resDiff.itemRound)}</span>
        <br>
        <h5> Item worth </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
        <br>
        <span>${this.roundCustom(this.resDiff.generalWorthRate, this.resDiff.goldRound)}</span>
        <br>`
      farmingContent += `
        <br>
        <h5> Farming items </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/skills/farming/farming.svg"></img>
        <br>
        <span>${this.roundCustom(this.resDiff.farmingItemRate, this.resDiff.itemRound)}</span>
        <br>
        <h5> Item worth </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
        <br>
        <span>${this.roundCustom(this.resDiff.farmingWorthRate, this.resDiff.goldRound)}</span>
        <br>`
    } else {
      // total item changes
      generalContent += `
        <div class="row">
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/bank_header.svg"></img>
                General Items
            </div>
            <div class="col-4">${this.roundCustom(this.resDiff.generalItemRate, this.resDiff.itemRound)}</div>
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
                ${this.roundCustom(this.resDiff.generalWorthRate, this.resDiff.goldRound)}
            </div>
        </div>`;
      farmingContent += `
        <div class="row">
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/skills/farming/farming.svg"></img>
                Farming Items
            </div>
            <div class="col-4">${this.roundCustom(this.resDiff.farmingItemRate, this.resDiff.itemRound)}</div>
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
                ${this.roundCustom(this.resDiff.farmingWorthRate, this.resDiff.goldRound)}
            </div>
        </div>`;
    }

    if (this.resDiff.generalChanges)
      content += generalContent
    if (this.resDiff.farmingChanges)
      content += farmingContent
    if (this.resDiff.lossChanges)
      content += lossContent

    // points
    pointContent = ``;
    pointContent += this.makePointRow(compact, "gp", "https://cdn.melvor.net/core/v018/assets/media/main/coins.svg");
    pointContent += this.makePointRow(compact, "hp", "https://cdn.melvor.net/core/v018/assets/media/skills/combat/hitpoints.svg");
    pointContent += this.makePointRow(compact, "kills", "https://cdn.melvor.net/core/v018/assets/media/skills/combat/combat.svg");
    pointContent += this.makePointRow(compact, "prayerPoints", "https://cdn.melvor.net/core/v018/assets/media/skills/prayer/prayer.svg");
    pointContent += this.makePointRow(compact, "slayerCoins", "https://cdn.melvor.net/core/v018/assets/media/main/slayer_coins.svg");
    pointContent = `<br/>
    <div class="row no-gutters">
        <h5 class="font-w700 text-center text-combat-smoke col-sm">Others</h5>
    </div>` + pointContent;

    if (this.resDiff.pointChanges) {
      content += pointContent;
    }

    // xp
    xpContent = `
    <br>
    <div class = "row no-gutters">
        <h5 class = "font-w700 text-center text-combat-smoke col"> Skill </h5>
        <h5 class = "font-w700 text-center text-combat-smoke col"> XP </h5>
        <h5 class = "font-w700 text-center text-combat-smoke col"> Time to Lvl </h5>
    </div>`

    //     for (let skillID = 0; skillID < game.skills.allObjects.length; skillID++) {
    //         let xpRow = ``;
    //         let skillName = SKILLS[skillID].name;
    //         let hasMastery = SKILLS[skillID].hasMastery;
    //         let xpRate = this.resDiff.xpRate[skillID];
    //         let xpChange = this.resDiff.xpChange[skillID];
    //         let poolPercRate = this.resDiff.poolPercRate[skillID]
    //         let masteryRate = this.resDiff.masteryRate[skillID]
    //         let xpToNext = itemTracker.curr.skills[skillID].xpToNext;
    //         let timeToLevel = xpToNext / (xpChange / this.resDiff.timePassed);
    //         let until100 = (itemTracker.curr.skills[skillID].poolMax / (this.resDiff.poolChange[skillID] - this.resDiff.timePassed)) * 100;

    //         if (xpChange == 0) {
    //             continue;
    //         } else {
    //             this.resDiff.skillChanges = true;
    //         }
    //         if (compact) {
    //             // TODO: mobile version
    //         } else {
    //             xpRow = `
    //                 <div class="row">
    //                     <div class="col-4">
    //                         <img class="nav-img" src="${SKILLS[skillID].media}"></img>
    //                         ${skillName}
    //                     </div>
    //                     <div class="col-4">
    //                         ${roundCustom(xpRate, 2)}
    //                     </div>
    //                     <div class="col-4">
    //                         ${getTimeString(timeToLevel)}
    //                     </div>

    //                 </div>`
    //             if (hasMastery && itemTracker.curr.skills[skillID].poolPerc < 100) {
    //                 xpRow += `
    //                     <div class="row">
    //                     <div class="col-4">
    //                     <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/mastery_header.svg"></img>
    //                     ${skillName}
    //                     </div>
    //                     <div class="col-4">
    //                     ${roundCustom(poolPercRate, 2)}%
    //                     </div>
    //                     <div class="col-4">
    //                     to 100%: ${getTimeString(until100)}
    //                     </div>

    //                     </div>`
    //             }
    //         }
    //         xpContent += xpRow
    //     }
    //     if (this.resDiff.skillChanges) {
    //         content += xpContent;
    //     }

    return content;
  }

  makePointRow(compact: boolean, pointName: SnapshotKeys, src: string) {
    if (this.resDiff.pointChange[pointName] != 0) {
      this.resDiff.pointChanges = true;
    } else {
      return ``;
    }
    let desc: { [name: string]: string } = {
      "hp": "Hitpoints",
      "prayerPoints": "Prayer Points",
      "slayerCoins": "Slayer Coins",
      "gp": "Cash",
      "kills": "Kills"
    }
    let pointRow = ``;
    if (compact) {
      pointRow = `
        <div class="pointer-enabled" onClick="window.dashboard.handleItemClick('${pointName}')">
            <img width="32" height="32" src="${src}"></img>
            <span>${this.roundCustom(this.resDiff.pointRate[pointName], 1)}</span>
        </div>`
      if (this.resDiff.pointTimeLeft[pointName]) {
        pointRow += `<div><span>${this.getTimeString(this.resDiff.pointTimeLeft[pointName])} left</span></div`
      }
    } else {
      pointRow = `
        <div class="row no-gutters pointer-enabled" onClick="window.dashboard.handleItemClick('${pointName}')">
            <div class="col-4">
                <img class="nav-img" src="${src}"></img>
                ${desc[pointName]}
            </div>
            <div class="col-8">
                ${this.roundCustom(this.resDiff.pointRate[pointName], 2)}
            </div>
        </div>`
      if (this.resDiff.pointTimeLeft[pointName]) {
        pointRow += `
            <div class="row no-gutters">
                <div class="col-4">
                    <img class="nav-img" src="${src}"></img>
                    ${this.roundCustom(this.itemTracker.curr[pointName], 2)}
                </div>
                <div class="col-8">
                    ${this.getTimeString(this.resDiff.pointTimeLeft[pointName])} left
                </div>
            </div>`
      }
    }
    return pointRow;
  }

  // window.dashItemRows = "";
  // window.dashPointRows = "";
  // window.dashContent = "";
  toggleBlacklist() {
    this.options.blacklistMode = !this.options.blacklistMode
  }

  updateDash() {
    let interval = this.options.trackIntervals[this.options.intervalTracked];
    let intervalLabel = interval[1];
    let content = this.getDashContent();
    let buttonLabel = (this.resDiff.intervalLabel == "reset") ? "Since last" : "Per:";
    // <button type="button" class="swal2-confirm swal2-styled onClick="window.dashboard.resetItemTracker()">Reset</button>`
    if (document.getElementById("dashContent") != null) {
      $("#dashContent").html(`
        <p>Time tracked: ${this.getTimeString(this.resDiff.timePassed)}</p>
        <button type="button" onClick="window.dashboard.toggleIntervalSize()" class="swal2-confirm swal2-styled" aria-label="" style="display: inline-block; background-color: rgb(55, 200, 55); border-left-color: rgb(48, 133, 214); border-right-color: rgb(48, 133, 214);">
            ${buttonLabel} ${this.resDiff.intervalLabel}
        </button>
        <button type="button" onClick="window.dashboard.toggleBlacklist()" class="swal2-confirm swal2-styled" aria-label="" style="display: inline-block; background-color: ${this.options.blacklistMode ? "rgb(200, 55, 55)" : "rgb(55, 200, 55)"}; border-left-color: rgb(48, 133, 214); border-right-color: rgb(48, 133, 214);">
        Blacklisting: ${this.options.blacklistMode}
        </button>
        ${content}
        `);
    }
  }

  openItemDash() {
    Swal.fire({
      title: 'M.I.I.D. (Item Dash)',
      html: `<small>by Gardens</small><div id="dashContent"></div>`,
      width: "50%",
      // openItemDash();
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Reset Tracker'
    }).then((result: any) => {
      if (result.value) {
        console.log("Resetting item tracker")
        this.resetItemTracker();
        setTimeout(this.openItemDash, 100);
      }
    })
  }
}

function InjectItemTrackerButton() {
  if (document.getElementById("dashWealthChange") == null) {
    window.dashboard = new ItemDashboard();
    let dashButton = `
        <li class="nav-main-item">
        <div class="nav-main-link nav-compact pointer-enabled" onclick="window.dashboard.openItemDash()">
        <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/statistics_header.svg">
        <span class="nav-main-link-name">Item Dash</span>
        <img src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg" style="margin-right: 4px;" width="16px" height="16px">
        <small id="dashWealthChange" class="text-warning" data-toggle="tooltip" data-html="true" data-placement="bottom"></small>
        </div>
        </li>`
    $(".nav-main .bank-space-nav").parent().parent().after(dashButton);
    window.dashboard.setupItemTracker();
    setInterval(() => {
      window.dashboard.trackerTick();
      window.dashboard.updateDash();
      // HACK for initial ticker:
      // $("#dashItems").html(getDashItemRows())
    }, 1000);
  }
}

function LoadItemDashboard() {
  // if ((window.isLoaded && !window.currentlyCatchingUp) ||
  //     (typeof unsafeWindow !== 'undefined' && unsafeWindow.isLoaded && !unsafeWindow.currentlyCatchingUp) ||
  //     document.getElementById("nav-menu-show") == null ||
  if (
    !(confirmedLoaded && characterSelected)
  ) {
    // console.log("Retrying...")
    setTimeout(LoadItemDashboard, 300);
    return;
  } else {
    InjectItemTrackerButton();
  }
}
LoadItemDashboard();
// window.dashboardLoaderInterval = setInterval()