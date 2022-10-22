
export async function setup(ctx: Modding.ModContext) {
  await ctx.loadScript('dashboard.js');

  ctx.onInterfaceReady(() => {
    // Code here will only get executed after the game, character, and
    // offline progress has been loaded.
    InjectItemTrackerButton();
  });
}