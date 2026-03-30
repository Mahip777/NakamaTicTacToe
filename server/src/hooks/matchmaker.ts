export const onMatchmakerMatched: nkruntime.MatchmakerMatchedFunction = (ctx, logger, nk, matchedUsers) => {
  const modeProp = matchedUsers[0]?.properties?.mode;
  const mode = modeProp === "timed" ? "timed" : "classic";
  const matchId = nk.matchCreate("tictactoe", {
    isPrivate: false,
    mode
  });
  logger.info("matchmaker matched %d users into %s", matchedUsers.length, matchId);
  return matchId;
};

export const beforeMatchmakerAdd: nkruntime.BeforeHookFunction<nkruntime.EnvelopeMatchmakerAdd> = (ctx, logger, _nk, envelope) => {
  if (!envelope.matchmakerAdd.stringProperties) {
    envelope.matchmakerAdd.stringProperties = {};
  }
  if (!envelope.matchmakerAdd.stringProperties.mode) {
    envelope.matchmakerAdd.stringProperties.mode = "classic";
  }
  logger.debug("matchmaker ticket requested by %s with mode %s", ctx.userId, envelope.matchmakerAdd.stringProperties.mode);
  return envelope;
};
