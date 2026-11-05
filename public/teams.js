// Team identities and screen positions stay fixed across halves and maps.
// Only the current CT/T side of the left team changes.
export function displaySettings(settings,leftSide=settings.leftSide){
  return {...settings,leftSide:leftSide==='T'?'T':'CT'};
}

export function createTeamTracker(){
  let first=new Set(),second=new Set(),side=null;
  function reset(state,leftSide){
    first=new Set(state.players.filter(p=>p.team===leftSide).map(p=>p.id));
    second=new Set(state.players.filter(p=>p.team!==leftSide&&['CT','T'].includes(p.team)).map(p=>p.id));
    side=leftSide;
    return side;
  }
  function update(state,fallback){
    const known=state.players.filter(p=>first.has(p.id)||second.has(p.id));
    if(!side||known.length<2){
      if(state.players.filter(p=>['CT','T'].includes(p.team)).length>=2)return reset(state,fallback);
      return side||fallback;
    }
    let ct=0,t=0;
    for(const player of known){
      if(!['CT','T'].includes(player.team))continue;
      const votesCT=first.has(player.id)?player.team==='CT':player.team==='T';
      if(votesCT)ct++;else t++;
    }
    // Ignore a single player or a partially received team-switch packet.
    if(ct>=2&&ct>t)side='CT';else if(t>=2&&t>ct)side='T';
    // Include replacements only after a clear assignment is available.
    if(Math.max(ct,t)>=2&&ct!==t){
      for(const player of state.players){
        if(first.has(player.id)||second.has(player.id))continue;
        if(player.team===side)first.add(player.id);
        else if(['CT','T'].includes(player.team))second.add(player.id);
      }
    }
    return side;
  }
  return {reset,update};
}
