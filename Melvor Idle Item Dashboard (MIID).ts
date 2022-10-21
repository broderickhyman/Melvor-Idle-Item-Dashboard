declare interface Window {
  dashboard: ItemDashboard;
}

class Options {
  public BlacklistItems: { [name: string]: boolean };
  public BlacklistMode: boolean;
  public IntervalTracked: number;
  public ItemTracked: string;
  public PointTracked: SnapshotKeys | "";
  public TrackIntervals: any;

  constructor() {
    this.BlacklistItems = {};
    this.BlacklistMode = false;
    this.IntervalTracked = 0;
    this.ItemTracked = "";
    this.PointTracked = "";
    this.TrackIntervals = [
      [0, 'reset'],
      [1, 'sec'],
      [60, 'min'],
      [3600, 'hour'],
      [3600 * 24, 'day']
    ];

    this.LoadOptions();
  }

  private LoadOptions() {
    let localCopy = localStorage.getItem(this.OptionsStorageKey());
    if (localCopy !== null) {
      const savedOptions = JSON.parse(localCopy) as Options;
      Object.assign(this, savedOptions);
    }
  }

  public SaveOptions() {
    localStorage.setItem(this.OptionsStorageKey(), JSON.stringify(this));
  }

  private OptionsStorageKey() {
    return "MIID-options-" + currentCharacter;
  }
}

interface SnapshotOptions {
  Gold: number;
  Health: number;
  Kills: number;
  PrayerPoints: number;
  SlayerCoins: number;
}

class Snapshot implements SnapshotOptions {
  dashboard: ItemDashboard;

  public BulkItems: { [name: string]: number };
  public Date: number;
  public Gold: number;
  public Health: number;
  public Kills: number;
  public PrayerPoints: number;
  public Skills: { [name: string]: SkillDiff };
  public SlayerCoins: number;

  constructor(dashboard: ItemDashboard) {
    this.dashboard = dashboard;

    this.BulkItems = this.OwnedItems();
    this.Date = (new Date()).getTime();
    this.Gold = game.gp.amount;
    this.Health = this.EffectiveHealth();
    this.Kills = this.TotalKills();
    this.PrayerPoints = game.combat.player.prayerPoints;
    this.Skills = this.allXP();
    this.SlayerCoins = game.slayerCoins.amount;
  }

  EffectiveHealth() {
    let foodObj = game.combat.player.food.currentSlot;
    let calcFoodQty = foodObj.quantity * (1 + game.combat.player.modifiers.increasedChanceToPreserveFood);
    let healValue = Math.floor(game.combat.player.getFoodHealing(foodObj.item) * this.AutoEatEfficiency() / 100);
    let hp = game.combat.player.hitpoints;
    if (calcFoodQty == 0)
      return hp;
    else
      return hp + calcFoodQty * healValue;
  }

  AutoEatEfficiency() {
    const percent = game.combat.player.modifiers.increasedAutoEatEfficiency - game.combat.player.modifiers.decreasedAutoEatEfficiency;
    return Math.max(percent, 1);
  }

  TotalKills() {
    return game.monsters.reduce((previous, current) => previous + game.stats.monsterKillCount(current), 0);
  }

  OwnedItems(silent = true) {
    function ensureItemExists(bulk: { [name: string]: number }, id: string) {
      if (!bulk[id]) {
        bulk[id] = 0;
      }
    }

    let bulk: { [name: string]: number } = {};
    // take everything in bank, pile it here
    for (let bankTab of game.bank.itemsByTab) {
      for (let bankSlot of bankTab) {
        let itemID = bankSlot.item.id;
        ensureItemExists(bulk, itemID);
        bulk[itemID] += bankSlot.quantity;
      }
    }

    // check equipment sets, ignore golbin loadout
    for (let equipmentSet of game.combat.player.equipmentSets) {
      let slotArray = equipmentSet.equipment.slotArray;
      for (let slot of slotArray) {
        let gearID = slot.item.id;
        ensureItemExists(bulk, gearID);
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
      ensureItemExists(bulk, foodID);
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

  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////         XP            //////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////

  allXP(silent = true) {
    let skills: { [name: string]: SkillDiff } = {};
    game.skills.forEach((skill) => {
      let skillDiff: SkillDiff = {
        Name: skill.name,
        Xp: skill.xp,
        Level: skill.level,
        Pool: 0,
        Mastery: 0,
        PoolMax: 0,
        PoolPercent: 0,
        XpToNext: this.dashboard.LevelToXp(skill.virtualLevel + 1) - skill.xp
      };
      !silent && console.log("skill: " + skill.name)
      if (skill.hasMastery) {
        let masterySkill = game.masterySkills.getObjectByID(skill.id);
        if (masterySkill) {
          skillDiff.Pool = masterySkill.masteryPoolXP;
          skillDiff.Mastery = masterySkill.totalMasteryXP;
          skillDiff.PoolMax = masterySkill.masteryPoolCap;
          skillDiff.PoolPercent = masterySkill.masteryPoolXP / masterySkill.masteryPoolCap;
        }
      }
      skills[skill.id] = skillDiff;
    });
    return skills;
  }
}

type SnapshotKeys = keyof SnapshotOptions;

class ResultDiff {
  public FarmingChanges: boolean;
  public FarmingItemChange: number;
  public FarmingItemRate: number;
  public FarmingWorthChange: number;
  public FarmingWorthRate: number;
  public GeneralChanges: boolean;
  public GeneralItemChange: number;
  public GeneralItemRate: number;
  public GeneralWorthChange: number;
  public GeneralWorthRate: number;
  public GoldRound: number;
  public IntervalDur: number;
  public IntervalLabel: string;
  public ItemChange: { [name: string]: number };
  public ItemRate: { [name: string]: number };
  public ItemRound: number;
  public LossChanges: boolean;
  public MasteryChange: { [name: string]: number };
  public MasteryRate: { [name: string]: number };
  public NetWealthChange: number;
  public NetWealthRate: number;
  public PointChange: { [name: string]: number };
  public PointChanges: boolean;
  public PointRate: { [name: string]: number };
  public PointTimeLeft: { [name: string]: number };
  public PoolChange: { [name: string]: number };
  public PoolPercChange: { [name: string]: number };
  public PoolPercRate: { [name: string]: number };
  public PoolRate: { [name: string]: number };
  public RateFactor: number;
  public SkillChanges: boolean;
  public TimeLeft: { [name: string]: number };
  public TimePassed: number;
  public TotalWorthChange: number;
  public TotalWorthRate: number;
  public WorthChange: { [name: string]: number };
  public WorthRate: { [name: string]: number };
  public XpChange: { [name: string]: number };
  public XpRate: { [name: string]: number };

  constructor() {
    this.FarmingChanges = false;
    this.FarmingItemChange = 0;
    this.FarmingItemRate = 0;
    this.FarmingWorthChange = 0;
    this.FarmingWorthRate = 0;
    this.GeneralChanges = false;
    this.GeneralItemChange = 0;
    this.GeneralItemRate = 0;
    this.GeneralWorthChange = 0;
    this.GeneralWorthRate = 0;
    this.GoldRound = 0;
    this.IntervalDur = -1;
    this.IntervalLabel = "default";
    this.ItemChange = {};
    this.ItemRate = {};
    this.ItemRound = 2;
    this.LossChanges = false;
    this.MasteryChange = {};
    this.MasteryRate = {};
    this.NetWealthChange = 0;
    this.NetWealthRate = 0;
    this.PointChange = {};
    this.PointChanges = false;
    this.PointRate = {};
    this.PointTimeLeft = {};
    this.PoolChange = {};
    this.PoolPercChange = {};
    this.PoolPercRate = {};
    this.PoolRate = {};
    this.RateFactor = 0;
    this.SkillChanges = false;
    this.TimeLeft = {};
    this.TimePassed = 0;
    this.TotalWorthChange = 0;
    this.TotalWorthRate = 0;
    this.WorthChange = {};
    this.WorthRate = {};
    this.XpChange = {};
    this.XpRate = {};
  }
}

class SkillDiff {
  public Level: number;
  public Mastery: number;
  public Name: string;
  public Pool: number;
  public PoolMax: number;
  public PoolPercent: number;
  public Xp: number;
  public XpToNext: number;

  constructor() {
    this.Level = 0;
    this.Mastery = 0;
    this.Name = "";
    this.Pool = 0;
    this.PoolMax = 0;
    this.PoolPercent = 0;
    this.Xp = 0;
    this.XpToNext = 0;
  }
}

class ItemDashboard {
  options: Options;
  itemTracker: {
    start: Snapshot;
    curr: Snapshot;
  };
  resDiff: ResultDiff;

  public levels: number[];

  constructor() {
    this.levels = [];
    this.SetupXpLevels();

    this.options = new Options();
    this.itemTracker = {
      start: new Snapshot(this),
      curr: new Snapshot(this),
    };
    this.resDiff = new ResultDiff();

    this.LoadItemTracker();
  }

  ResetResultDiff() {
    this.resDiff = new ResultDiff();
  }

  ToggleIntervalSize() {
    if (this.options.ItemTracked !== "") {
      this.options.ItemTracked = "";
      this.options.IntervalTracked = 0;
    }
    this.options.IntervalTracked = (this.options.IntervalTracked + 1) % this.options.TrackIntervals.length;
  }

  GetTimeString(seconds: number) {
    let s = Math.round(seconds)
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

  ResetItemTracker() {
    this.itemTracker.start = new Snapshot(this);
    this.itemTracker.curr = new Snapshot(this);
    this.TickTracker();
  }

  LoadItemTracker() {
    let localCopy = localStorage.getItem(this.ItemTrackerStorageKey());
    if (localCopy == null) {
      this.ResetItemTracker();
    } else {
      let savedSnapshot = JSON.parse(localCopy);
      if (savedSnapshot && savedSnapshot.Date) {
        let savedStart = savedSnapshot as Snapshot;
        Object.assign(this.itemTracker.start, savedStart);
      }
    }
  }

  SaveItemTracker() {
    localStorage.setItem(this.ItemTrackerStorageKey(), JSON.stringify(this.itemTracker.start, (key, value) => {
      if (key === "dashboard") {
        return null;
      }
      return value;
    }));
  }

  ItemTrackerStorageKey() {
    return "MIID-item-tracker-start-" + currentCharacter;
  }

  RoundCustom(nr: number, roundDigits = 0, letters = true) {
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

  SetItemTracked(itemID: string) {
    this.options.ItemTracked = itemID;
  }

  TickTracker(silent = true) {
    this.itemTracker.curr = new Snapshot(this);
    let { start, curr } = this.itemTracker;
    this.ResetResultDiff();
    this.resDiff.TimePassed = (curr.Date - start.Date) / 1000;
    // save tracker
    this.SaveItemTracker();
    this.options.SaveOptions();

    !silent && console.log(`xp change: ${this.resDiff.XpChange}`)
    let rateFactor = 1;
    const itemTracked = this.options.ItemTracked;
    if (itemTracked == "") {
      // time-based tracking
      let interval = this.options.TrackIntervals[this.options.IntervalTracked];
      this.resDiff.IntervalDur = interval[0];
      this.resDiff.IntervalLabel = interval[1];
      if (this.resDiff.IntervalDur == 0) {
        rateFactor = 1;
      } else {
        rateFactor = this.resDiff.TimePassed / this.resDiff.IntervalDur;
      }
    } else {
      if (!this.options.ItemTracked) {
        // point tracking
        if (this.options.PointTracked) {
          const snapshotKey = this.options.PointTracked;
          rateFactor = curr[snapshotKey] - start[snapshotKey];
          this.resDiff.IntervalLabel = this.options.ItemTracked;
        } else {
          console.log(`Error tracking by ${this.options.ItemTracked}`);
        }
      } else {
        // track relative to a specific item's change
        rateFactor = this.itemTracker.curr.BulkItems[this.options.ItemTracked] -
          this.itemTracker.start.BulkItems[this.options.ItemTracked]

        let itemData = game.items.getObjectByID(this.options.ItemTracked);
        if (itemData) {
          this.resDiff.IntervalLabel = itemData.name;
        }
        !silent && console.log(`Tracking by ${this.options.ItemTracked}`)
      }
    }

    // items
    let trackedItemIDs = new Set<string>();
    for (let itemID in start.BulkItems) {
      trackedItemIDs.add(itemID);
    }
    for (let itemID in curr.BulkItems) {
      trackedItemIDs.add(itemID);
    }

    trackedItemIDs.forEach((itemID) => {
      let itemData = game.items.getObjectByID(itemID);
      if (!itemData || (this.options.BlacklistItems[itemID] && !this.options.BlacklistMode)) {
        return;
      }
      let startQty = start.BulkItems[itemID] || 0;
      let currQty = curr.BulkItems[itemID] || 0;
      let change = currQty - startQty;
      if (change == 0) return;

      // absolute change, interval rate, time left
      this.resDiff.ItemChange[itemID] = change;
      this.resDiff.ItemRate[itemID] = change / rateFactor;

      // register change
      !silent && console.log(`${itemData.name} changed by ${this.resDiff.ItemRate[itemID]} / ${this.resDiff.IntervalLabel}`);
      let worthChange = change * itemData.sellsFor;
      this.resDiff.WorthChange[itemID] = worthChange;
      this.resDiff.WorthRate[itemID] = worthChange / rateFactor;
      // split by farming
      if (itemData.category == "Farming") {
        this.resDiff.FarmingChanges = true;
        this.resDiff.FarmingItemChange += change;
        this.resDiff.FarmingWorthChange += worthChange;
      } else {
        this.resDiff.GeneralChanges = true;
        this.resDiff.GeneralItemChange += change;
        this.resDiff.GeneralWorthChange += worthChange;
      }
      if (change < 0 && currQty > 0) {
        this.resDiff.LossChanges = true;
        let timeLeft = currQty / (-change / this.resDiff.TimePassed);
        this.resDiff.TimeLeft[itemID] = timeLeft;
        !silent && console.log(`${itemData.name} running out in ${this.resDiff.TimeLeft[itemID]}`);
      }
    });

    this.resDiff.GeneralItemRate = this.resDiff.GeneralItemChange / rateFactor;
    this.resDiff.GeneralWorthRate = this.resDiff.GeneralWorthChange / rateFactor;

    this.resDiff.FarmingItemRate = this.resDiff.FarmingItemChange / rateFactor;
    this.resDiff.FarmingWorthRate = this.resDiff.FarmingWorthChange / rateFactor;

    this.resDiff.TotalWorthChange = this.resDiff.GeneralWorthChange + this.resDiff.FarmingWorthChange;
    this.resDiff.TotalWorthRate = this.resDiff.TotalWorthChange / rateFactor;

    this.resDiff.NetWealthChange = this.resDiff.TotalWorthChange + curr.Gold - start.Gold;
    this.resDiff.NetWealthRate = (this.resDiff.TotalWorthChange + curr.Gold - start.Gold) / rateFactor;
    // points
    let pointNames: SnapshotKeys[] = ["Gold", "PrayerPoints", "SlayerCoins", "Health", "Kills"];
    let trackTimeLeft: { [name: string]: boolean } = { "prayerPoints": true, "hp": true };
    for (let pointName of pointNames) {
      let startQty = start[pointName];
      let currQty = curr[pointName];
      let change = currQty - startQty;
      let rate = change / rateFactor;
      this.resDiff.PointRate[pointName] = rate;
      this.resDiff.PointChange[pointName] = change;
      if (!silent && change != 0) console.log(pointName, " differ by", rate, "/", this.resDiff.IntervalLabel);
      if (currQty > 0 && change < 0 && trackTimeLeft[pointName]) {
        let timeLeft = currQty / (-change / this.resDiff.TimePassed);
        this.resDiff.PointTimeLeft[pointName] = timeLeft;
        !silent && console.log(`${pointName} point running out in ${this.resDiff.PointTimeLeft[pointName]}`);
      }
    }

    // XP
    for (let skillID in this.itemTracker.curr.Skills) {
      this.resDiff.XpChange[skillID] = this.itemTracker.curr.Skills[skillID].Xp - start.Skills[skillID].Xp;
      this.resDiff.XpRate[skillID] = this.resDiff.XpChange[skillID] / rateFactor

      this.resDiff.PoolPercChange[skillID] = this.itemTracker.curr.Skills[skillID].PoolPercent - start.Skills[skillID].PoolPercent;
      this.resDiff.PoolPercRate[skillID] = this.resDiff.PoolPercChange[skillID] / rateFactor;

      this.resDiff.PoolChange[skillID] = this.itemTracker.curr.Skills[skillID].Pool - start.Skills[skillID].Pool;
      this.resDiff.PoolRate[skillID] = this.resDiff.PoolChange[skillID] / rateFactor;

      this.resDiff.MasteryChange[skillID] = this.itemTracker.curr.Skills[skillID].Mastery - start.Skills[skillID].Mastery;
      this.resDiff.MasteryRate[skillID] = this.resDiff.MasteryChange[skillID] / rateFactor;
    }

    this.resDiff.RateFactor = rateFactor;
    // glove charges (todo)
    if (document.getElementById("dashWealthChange") != null) {
      $("#dashWealthChange").text(`${this.RoundCustom(this.resDiff.NetWealthRate, 0)}/${this.resDiff.IntervalLabel}`);
    }
  }

  HandleItemClick(itemID: string) {
    if (this.options.BlacklistMode) {
      if (this.options.BlacklistItems[itemID]) {
        this.options.BlacklistItems[itemID] = false;
      } else {
        this.options.BlacklistItems[itemID] = true;
      }
    } else {
      this.SetItemTracked(itemID);
    }
    this.UpdateDashboard();
  }

  GetDashContent() {
    let compact = $(window).width() as number < 1250;
    // use curr and start to generate some item rows, and change #dashItems for it
    let generalContent = ``
    let farmingContent = ``;
    let lossContent = ``;
    let pointContent = ``;
    let xpContent = ``;
    let content = ``;

    // each item row
    for (let itemID in this.resDiff.ItemChange) {
      let itemData = game.items.getObjectByID(itemID);
      if (!itemData || (this.options.BlacklistItems[itemID] && !this.options.BlacklistMode)) {
        continue;
      }
      let change = this.resDiff.ItemChange[itemID];

      // each item's change, put in the right content chunk
      // display if change is nonzero or blacklisted item in blacklist mode
      if ((change !== undefined && change !== 0) || (this.options.BlacklistItems[itemID] && this.options.BlacklistMode)) {
        let itemRate = this.RoundCustom(this.resDiff.ItemRate[itemID], this.resDiff.ItemRound);
        let worthRate = this.RoundCustom(this.resDiff.WorthRate[itemID], this.resDiff.GoldRound);
        let banned = this.options.BlacklistItems[itemID];
        let row;
        // create item row
        if (compact) {
          row = `
                <div class="pointer-enabled" onClick="window.dashboard.HandleItemClick('${itemID}')">
                    <img width="32" height="32" src="${itemData.media}"></img>
                    <span>
                        ${banned ? String(itemRate).strike() : itemRate}
                    </span>
                    <br>
                </div`;
        } else {
          row = `
                <div class="row">
                    <div class="col-4 pointer-enabled" onClick="window.dashboard.HandleItemClick('${itemID}')">
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
        if (this.resDiff.TimeLeft[itemID] > 0) {
          let timeString = this.GetTimeString(this.resDiff.TimeLeft[itemID]);
          let lossRow = ``;
          if (compact) {
            lossRow = `
                    <div class="pointer-enabled" onClick="window.dashboard.HandleItemClick('${itemID}')">
                        <img width="32" height="32" src="${itemData.media}"></img>
                        <span>
                            ${timeString} left
                        </span>
                        <br>
                    </div`;
          } else {
            lossRow = `
                    <div class="row pointer-enabled" onClick="window.dashboard.HandleItemClick('${itemID}')">
                        <div class="col-6">
                            <img class="nav-img" src="${itemData.media}"></img>
                            ${this.RoundCustom(this.itemTracker.curr.BulkItems[itemID], 1)}
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
        <span>${this.RoundCustom(this.resDiff.GeneralItemRate, this.resDiff.ItemRound)}</span>
        <br>
        <h5> Item worth </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
        <br>
        <span>${this.RoundCustom(this.resDiff.GeneralWorthRate, this.resDiff.GoldRound)}</span>
        <br>`
      farmingContent += `
        <br>
        <h5> Farming items </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/skills/farming/farming.svg"></img>
        <br>
        <span>${this.RoundCustom(this.resDiff.FarmingItemRate, this.resDiff.ItemRound)}</span>
        <br>
        <h5> Item worth </h5>
        <img width="32" height="32" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
        <br>
        <span>${this.RoundCustom(this.resDiff.FarmingWorthRate, this.resDiff.GoldRound)}</span>
        <br>`
    } else {
      // total item changes
      generalContent += `
        <div class="row">
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/bank_header.svg"></img>
                General Items
            </div>
            <div class="col-4">${this.RoundCustom(this.resDiff.GeneralItemRate, this.resDiff.ItemRound)}</div>
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
                ${this.RoundCustom(this.resDiff.GeneralWorthRate, this.resDiff.GoldRound)}
            </div>
        </div>`;
      farmingContent += `
        <div class="row">
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/skills/farming/farming.svg"></img>
                Farming Items
            </div>
            <div class="col-4">${this.RoundCustom(this.resDiff.FarmingItemRate, this.resDiff.ItemRound)}</div>
            <div class="col-4">
                <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg"></img>
                ${this.RoundCustom(this.resDiff.FarmingWorthRate, this.resDiff.GoldRound)}
            </div>
        </div>`;
    }

    if (this.resDiff.GeneralChanges)
      content += generalContent
    if (this.resDiff.FarmingChanges)
      content += farmingContent
    if (this.resDiff.LossChanges)
      content += lossContent

    // points
    pointContent = ``;
    pointContent += this.MakePointRow(compact, "Gold", "https://cdn.melvor.net/core/v018/assets/media/main/coins.svg");
    pointContent += this.MakePointRow(compact, "Health", "https://cdn.melvor.net/core/v018/assets/media/skills/combat/hitpoints.svg");
    pointContent += this.MakePointRow(compact, "Kills", "https://cdn.melvor.net/core/v018/assets/media/skills/combat/combat.svg");
    pointContent += this.MakePointRow(compact, "PrayerPoints", "https://cdn.melvor.net/core/v018/assets/media/skills/prayer/prayer.svg");
    pointContent += this.MakePointRow(compact, "SlayerCoins", "https://cdn.melvor.net/core/v018/assets/media/main/slayer_coins.svg");
    pointContent = `<br/>
    <div class="row no-gutters">
        <h5 class="font-w700 text-center text-combat-smoke col-sm">Others</h5>
    </div>` + pointContent;

    if (this.resDiff.PointChanges) {
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

    for (let skillID in this.itemTracker.curr.Skills) {
      let skillData = game.skills.getObjectByID(skillID);
      if (!skillData) {
        continue;
      }
      let currentSkill = this.itemTracker.curr.Skills[skillID];
      let xpRow = ``;
      let skillName = skillData.name;
      let hasMastery = skillData.hasMastery;
      let xpRate = this.resDiff.XpRate[skillID];
      let xpChange = this.resDiff.XpChange[skillID];
      let poolPercRate = this.resDiff.PoolPercRate[skillID]
      let masteryRate = this.resDiff.MasteryRate[skillID]
      let xpToNext = currentSkill.XpToNext;
      let timeToLevel = xpToNext / (xpChange / this.resDiff.TimePassed);
      let poolChange = this.resDiff.PoolChange[skillID];
      let until100 = 0;
      if (poolChange) {
        until100 = ((currentSkill.PoolMax - currentSkill.Pool) / (poolChange / this.resDiff.TimePassed));
      }

      if (xpChange == 0) {
        continue;
      } else {
        this.resDiff.SkillChanges = true;
      }
      if (compact) {
        // TODO: mobile version
      } else {
        if (skillData.virtualLevel < skillData.levelCap) {
          xpRow = `
                <div class="row">
                    <div class="col-4">
                        <img class="nav-img" src="${skillData.media}"></img>
                        ${skillName}
                    </div>
                    <div class="col-4">
                        ${this.RoundCustom(xpRate, 2)}
                    </div>
                    <div class="col-4">
                        ${this.GetTimeString(timeToLevel)}
                    </div>

                </div>`;
        }
        if (hasMastery && this.itemTracker.curr.Skills[skillID].PoolPercent < 100) {
          xpRow += `
                    <div class="row">
                    <div class="col-4">
                    <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/mastery_header.svg"></img>
                    ${skillName}
                    </div>
                    <div class="col-4">
                    ${this.RoundCustom(poolPercRate, 3)}%
                    </div>
                    <div class="col-4">
                    to 100%: ${this.GetTimeString(until100)}
                    </div>

                    </div>`;
        }
      }
      xpContent += xpRow;
    }
    if (this.resDiff.SkillChanges) {
      content += xpContent;
    }

    return content;
  }

  MakePointRow(compact: boolean, pointName: SnapshotKeys, src: string) {
    if (this.resDiff.PointChange[pointName] != 0) {
      this.resDiff.PointChanges = true;
    } else {
      return ``;
    }
    let desc: { [key in keyof SnapshotOptions]: string } = {
      "Health": "Hitpoints",
      "PrayerPoints": "Prayer Points",
      "SlayerCoins": "Slayer Coins",
      "Gold": "Cash",
      "Kills": "Kills"
    }
    let pointRow = ``;
    if (compact) {
      pointRow = `
        <div class="pointer-enabled" onClick="window.dashboard.HandleItemClick('${pointName}')">
            <img width="32" height="32" src="${src}"></img>
            <span>${this.RoundCustom(this.resDiff.PointRate[pointName], 1)}</span>
        </div>`
      if (this.resDiff.PointTimeLeft[pointName]) {
        pointRow += `<div><span>${this.GetTimeString(this.resDiff.PointTimeLeft[pointName])} left</span></div`
      }
    } else {
      pointRow = `
        <div class="row no-gutters pointer-enabled" onClick="window.dashboard.HandleItemClick('${pointName}')">
            <div class="col-4">
                <img class="nav-img" src="${src}"></img>
                ${desc[pointName]}
            </div>
            <div class="col-8">
                ${this.RoundCustom(this.resDiff.PointRate[pointName], 2)}
            </div>
        </div>`
      if (this.resDiff.PointTimeLeft[pointName]) {
        pointRow += `
            <div class="row no-gutters">
                <div class="col-4">
                    <img class="nav-img" src="${src}"></img>
                    ${this.RoundCustom(this.itemTracker.curr[pointName], 2)}
                </div>
                <div class="col-8">
                    ${this.GetTimeString(this.resDiff.PointTimeLeft[pointName])} left
                </div>
            </div>`
      }
    }
    return pointRow;
  }

  ToggleBlacklist() {
    this.options.BlacklistMode = !this.options.BlacklistMode
  }

  UpdateDashboard() {
    let interval = this.options.TrackIntervals[this.options.IntervalTracked];
    let intervalLabel = interval[1];
    let content = this.GetDashContent();
    let buttonLabel = (this.resDiff.IntervalLabel == "reset") ? "Since last" : "Per:";
    // <button type="button" class="swal2-confirm swal2-styled onClick="window.dashboard.ResetItemTracker()">Reset</button>`
    if (document.getElementById("dashContent") != null) {
      $("#dashContent").html(`
        <p>Time tracked: ${this.GetTimeString(this.resDiff.TimePassed)}</p>
        <button type="button" onClick="window.dashboard.ToggleIntervalSize()" class="swal2-confirm swal2-styled" aria-label="" style="display: inline-block; background-color: rgb(55, 200, 55); border-left-color: rgb(48, 133, 214); border-right-color: rgb(48, 133, 214);">
            ${buttonLabel} ${this.resDiff.IntervalLabel}
        </button>
        <button type="button" onClick="window.dashboard.ToggleBlacklist()" class="swal2-confirm swal2-styled" aria-label="" style="display: inline-block; background-color: ${this.options.BlacklistMode ? "rgb(200, 55, 55)" : "rgb(55, 200, 55)"}; border-left-color: rgb(48, 133, 214); border-right-color: rgb(48, 133, 214);">
        Blacklisting: ${this.options.BlacklistMode}
        </button>
        ${content}
        `);
    }
  }

  OpenItemDashboard() {
    var dashboard = this;
    Swal.fire({
      title: 'M.I.I.D. (Item Dash)',
      html: `<div><small>Created by Gardens</small></div><div><small>Updated by MyPickle</small></div><div id="dashContent"></div>`,
      width: "50%",
      // openItemDash();
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Reset Tracker'
    }).then((result: any) => {
      if (result.value) {
        console.log("Resetting item tracker")
        dashboard.ResetItemTracker();
        setTimeout(dashboard.OpenItemDashboard, 100);
      }
    })
  }

  LevelToXp(level: number) {
    let xp = 0;
    for (let l = 1; l <= level - 1; l++) {
      xp += Math.floor(l + 300 * Math.pow(2, l / 7))
    }
    return Math.floor(xp / 4);
  }

  SetupXpLevels() {
    for (let i = 0; i < 200; i++) {
      this.levels[i] = this.LevelToXp(i)
    }
  }

  XpToLevel(xp: number) {
    let level = 1;
    while (this.levels[level + 1] <= xp) level++;
    return level;
  }
}

function InjectItemTrackerButton() {
  if (document.getElementById("dashWealthChange") == null) {
    window.dashboard = new ItemDashboard();
    let dashButton = `
        <li class="nav-main-item">
        <div class="nav-main-link nav-compact pointer-enabled" onclick="window.dashboard.OpenItemDashboard()">
        <img class="nav-img" src="https://cdn.melvor.net/core/v018/assets/media/main/statistics_header.svg">
        <span class="nav-main-link-name">Item Dash</span>
        <img src="https://cdn.melvor.net/core/v018/assets/media/main/coins.svg" style="margin-right: 4px;" width="16px" height="16px">
        <small id="dashWealthChange" class="text-warning" data-toggle="tooltip" data-html="true" data-placement="bottom"></small>
        </div>
        </li>`
    $(".nav-main .bank-space-nav").parent().parent().after(dashButton);
    setInterval(() => {
      window.dashboard.TickTracker();
      window.dashboard.UpdateDashboard();
      // HACK for initial ticker:
      // $("#dashItems").html(getDashItemRows())
    }, 1000);
  }
}

function LoadItemDashboard() {
  // if ((window.isLoaded && !window.currentlyCatchingUp) ||
  //     document.getElementById("nav-menu-show") == null ||
  if (
    !(confirmedLoaded && characterSelected)
  ) {
    // console.log("Retrying...")
    setTimeout(LoadItemDashboard, 500);
    return;
  } else {
    InjectItemTrackerButton();
  }
}
LoadItemDashboard();
// window.dashboardLoaderInterval = setInterval()
