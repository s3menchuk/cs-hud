const magazine='<svg class="ammo-unit" viewBox="0 0 12 18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 1h7v10l-3 6-5-2 1-5Z"/><path d="M5 4h3M5 7h3M4 10h3"/></svg>';
const round='<svg class="ammo-unit" viewBox="0 0 12 18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 7c0-3 3-6 3-6s3 3 3 6v10H3ZM3 11h6"/></svg>';
export function renderAmmo(player,className='player-ammo'){
  if(player.health<=0||!Number.isInteger(player.ammo)||player.ammo<0)return '';
  const hasReserve=Number.isInteger(player.reserve)&&player.reserve>=0;
  const individual=['shells','rounds'].includes(player.reserveUnit);
  const unit=individual?'патроны в запасе':'запасные магазины';
  return `<span class="${className}" title="Патроны в магазине / ${unit}" aria-label="В магазине ${player.ammo}${hasReserve?', в запасе '+player.reserve:''}"><b>${player.ammo}</b>${hasReserve?`<small> / ${player.reserve}</small>${individual?round:magazine}`:''}</span>`;
}
