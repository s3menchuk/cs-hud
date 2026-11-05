const messages={
 ru:{
  bombProgress:'До взрыва C4',
  roundKills:'Убийства в текущем раунде: {n}',
  removeLogo:'Удалить логотип',
  kills:'Убийства',deaths:'Смерти',
  editor:'Редактор',layoutTitle:'Редактор HUD',layoutHint:'Выберите элемент в превью. Перетащите рамку или потяните угол для изменения размера.',layoutElement:'Элемент',part_scoreboard:'Верхнее табло',part_leftRoster:'Игроки слева',part_rightRoster:'Игроки справа',part_radar:'Мини-карта',part_focus:'Текущий игрок',layoutScale:'Размер',layoutOpacity:'Непрозрачность элемента',layoutVisible:'Показывать элемент',layoutResetPart:'Сбросить элемент',layoutTheme:'Общее оформление',layoutPanel:'Фон',layoutText:'Текст',layoutMuted:'Детали',layoutBackground:'Непрозрачность фона',layoutRadius:'Скругление',layoutFont:'Шрифт',layoutFontCondensed:'Узкий',layoutFontSans:'Обычный',layoutFontMono:'Моноширинный',layoutGrid:'Сетка в редакторе',layoutUndo:'Назад',layoutRedo:'Вперёд',layoutImport:'Импорт JSON',layoutExport:'Экспорт JSON',layoutResetAll:'Исходное оформление',layoutSave:'Применить к трансляции',layoutDiscard:'Отменить изменения',layoutSaving:'Сохранение…',layoutDraft:'Черновик: изменения видны только в предпросмотре.',layoutSaved:'Оформление сохранено для трансляции.',layoutSaveError:'Не удалось сохранить оформление. Проверьте соединение с сервером.',layoutInvalid:'Некорректный файл оформления.',

  players:'Игроки',avatars:'Аватарки игроков',avatarHint:'Загрузите фото игрока. Привязка по Steam ID сохраняется при смене ника и сторон.',avatarDemoHint:'Сейчас показаны демоигроки. Для настройки реального состава подключите CS2.',avatarFormats:'PNG, JPG или WebP до 5 МБ. Фото автоматически обрезается до квадрата и сохраняется сразу.',avatarUpload:'Загрузить',avatarReplace:'Заменить',avatarRemove:'Удалить',avatarSaving:'Сохранение…',avatarSaved:'Аватарка сохранена',avatarRemoved:'Аватарка удалена',avatarFileError:'Выберите PNG, JPG или WebP до 5 МБ',avatarDecodeError:'Не удалось прочитать изображение',avatarOffline:'Не в текущем составе',

  language:'Язык',openOverlay:'Открыть оверлей',preview:'Предпросмотр',design:'Оформление',series:'Серия',connect:'Подключение',teams:'Команды',team1:'КОМАНДА 1',team2:'КОМАНДА 2',teamName1:'Название команды 1',teamName2:'Название команды 2',teamColor1:'Цвет команды 1',teamColor2:'Цвет команды 2',uploadLogo:'Логотип PNG, JPG или WebP до 500 КБ',swap:'Сменить стороны CT / T',elements:'Элементы HUD',radar:'Мини-карта',equipment:'Стоимость снаряжения',focus:'Карточка текущего игрока',apply:'Применить',seriesTitle:'Серия карт',format:'Формат',bo1:'BO1 — одна карта',bo3:'BO3 — до 2 побед',bo5:'BO5 — до 3 побед',currentMap:'Текущая карта',results:'Результаты карт',map:'КАРТА',completed:'Карта сыграна',seriesHint:'Счёт команд 1 и 2. Отметьте ✓ у завершённых карт.',saveSeries:'Сохранить серию',obsSource:'Источник в OBS',obsHint:'Источник «Браузер», размер 1920 × 1080. Адрес:',copy:'Скопировать адрес',gsiTitle:'Подключение CS2',gsi1:'Скачайте GSI-конфиг.',gsi2:'Поместите его в game/csgo/cfg внутри папки CS2.',gsi3:'Перезапустите CS2 и откройте матч наблюдателем/GOTV или демозапись.',download:'Скачать GSI-конфиг',gsiHint:'CS2 и HUD должны работать на одном компьютере.',connected:'CS2 подключена',demo:'Демонстрационные данные',noSignal:'Нет сигнала CS2',serverOffline:'Сервер недоступен',sideStatus:'Команда 1: {side1} · Команда 2: {side2} · Команда 1 слева',mapNumber:'Карта {n}',mapName:'Карта {n}: название',mapScore1:'Карта {n}: счёт команды 1',mapScore2:'Карта {n}: счёт команды 2',mapDone:'Карта {n} сыграна',unsaved:'Есть несохранённые изменения',savedSeries:'Серия сохранена',updatedSeries:'История карт обновлена',applied:'Настройки применены',swapHint:'Команда 1 играет за {side}. Нажмите «Применить».',logoError:'Выберите PNG, JPG или WebP до 500 КБ',copied:'Адрес скопирован',copyError:'Скопируйте адрес из поля выше',requestError:'Ошибка запроса',
 },
 en:{
  bombProgress:'Time until C4 explosion',
  roundKills:'Kills this round: {n}',
  removeLogo:'Remove logo',
  kills:'Kills',deaths:'Deaths',
  editor:'Editor',layoutTitle:'HUD editor',layoutHint:'Select an element in the preview. Drag its frame or resize it using the corner handle.',layoutElement:'Element',part_scoreboard:'Scoreboard',part_leftRoster:'Left players',part_rightRoster:'Right players',part_radar:'Minimap',part_focus:'Current player',layoutScale:'Size',layoutOpacity:'Element opacity',layoutVisible:'Show element',layoutResetPart:'Reset element',layoutTheme:'Overall appearance',layoutPanel:'Background',layoutText:'Text',layoutMuted:'Details',layoutBackground:'Background opacity',layoutRadius:'Corner radius',layoutFont:'Font',layoutFontCondensed:'Condensed',layoutFontSans:'Sans serif',layoutFontMono:'Monospace',layoutGrid:'Editor grid',layoutUndo:'Undo',layoutRedo:'Redo',layoutImport:'Import JSON',layoutExport:'Export JSON',layoutResetAll:'Default appearance',layoutSave:'Apply to broadcast',layoutDiscard:'Discard changes',layoutSaving:'Saving…',layoutDraft:'Draft: changes are visible only in this preview.',layoutSaved:'Appearance saved for the broadcast.',layoutSaveError:'Could not save the appearance. Check the server connection.',layoutInvalid:'Invalid appearance file.',

  players:'Players',avatars:'Player avatars',avatarHint:'Upload a player photo. Steam ID binding survives name changes and side swaps.',avatarDemoHint:'These are demo players. Connect CS2 to configure the real roster.',avatarFormats:'PNG, JPG or WebP, up to 5 MB. Photos are cropped to a square and saved immediately.',avatarUpload:'Upload',avatarReplace:'Replace',avatarRemove:'Remove',avatarSaving:'Saving…',avatarSaved:'Avatar saved',avatarRemoved:'Avatar removed',avatarFileError:'Choose PNG, JPG or WebP, up to 5 MB',avatarDecodeError:'Could not read the image',avatarOffline:'Not in the current roster',

  language:'Language',openOverlay:'Open overlay',preview:'Preview',design:'Appearance',series:'Series',connect:'Connection',teams:'Teams',team1:'TEAM 1',team2:'TEAM 2',teamName1:'Team 1 name',teamName2:'Team 2 name',teamColor1:'Team 1 color',teamColor2:'Team 2 color',uploadLogo:'PNG, JPG or WebP logo, up to 500 KB',swap:'Swap CT / T sides',elements:'HUD elements',radar:'Minimap',equipment:'Equipment value',focus:'Current player card',apply:'Apply',seriesTitle:'Map series',format:'Format',bo1:'BO1 — single map',bo3:'BO3 — first to 2 wins',bo5:'BO5 — first to 3 wins',currentMap:'Current map',results:'Map results',map:'MAP',completed:'Map completed',seriesHint:'Scores for teams 1 and 2. Check ✓ for completed maps.',saveSeries:'Save series',obsSource:'OBS source',obsHint:'Browser source, 1920 × 1080. URL:',copy:'Copy URL',gsiTitle:'Connect CS2',gsi1:'Download the GSI config.',gsi2:'Place it in game/csgo/cfg inside your CS2 folder.',gsi3:'Restart CS2 and open a match as an observer/GOTV or play a demo.',download:'Download GSI config',gsiHint:'Run CS2 and the HUD on the same computer.',connected:'CS2 connected',demo:'Demo data',noSignal:'No CS2 signal',serverOffline:'Server unavailable',sideStatus:'Team 1: {side1} · Team 2: {side2} · Team 1 on the left',mapNumber:'Map {n}',mapName:'Map {n}: name',mapScore1:'Map {n}: team 1 score',mapScore2:'Map {n}: team 2 score',mapDone:'Map {n} completed',unsaved:'Unsaved changes',savedSeries:'Series saved',updatedSeries:'Map history updated',applied:'Settings applied',swapHint:'Team 1 is on {side}. Click Apply.',logoError:'Choose PNG, JPG or WebP, up to 500 KB',copied:'URL copied',copyError:'Copy the URL from the field above',requestError:'Request failed',
 }
};
let language='ru';
try{if(globalThis.localStorage?.getItem('cs2-broadcast-hud-admin-language')==='en')language='en';}catch{}
export const getLanguage=()=>language;
export function setLanguage(value){language=value==='en'?'en':'ru';try{globalThis.localStorage?.setItem('cs2-broadcast-hud-admin-language',language);}catch{}return language;}
export function t(key,values={}){return (messages[language][key]||messages.ru[key]||key).replace(/\{(\w+)\}/g,(_m,name)=>String(values[name]??''));}
export function applyTranslations(root=document){
 root.documentElement?.setAttribute('lang',language);
 for(const element of root.querySelectorAll('[data-i18n]'))element.textContent=t(element.dataset.i18n);
 for(const element of root.querySelectorAll('[data-i18n-title]'))element.title=t(element.dataset.i18nTitle);
 for(const element of root.querySelectorAll('[data-i18n-aria]'))element.setAttribute('aria-label',t(element.dataset.i18nAria));
}
export function translateError(message){
 if(message==='layoutInvalid')return t('layoutInvalid');
 if(language==='ru')return message;
 const fixed={
  'Неверный Steam ID игрока.':'Invalid player Steam ID.',
  'Выберите PNG, JPG или WebP.':'Choose PNG, JPG or WebP.',
  'Аватарка должна быть меньше 500 КБ.':'The processed avatar must be smaller than 500 KB.',
  'Не удалось прочитать изображение.':'Could not read the image.',
  'Формат серии должен быть BO1, BO3 или BO5.':'Choose BO1, BO3 or BO5.',
  'Выберите текущую карту в пределах серии.':'Choose a current map within the series.',
  'Заполняйте результаты сыгранных карт по порядку.':'Enter completed maps in order.',
  'После победы в серии дополнительные сыгранные карты невозможны.':'No more maps can be completed after a team wins the series.',
 };
 if(fixed[message])return fixed[message];
 const patterns=[[/В BO(\d) может быть не больше (\d) карт\./,m=>`BO${m[1]} allows up to ${m[2]} maps.`],[/Проверьте данные карты (\d+)\./,m=>`Check the details for map ${m[1]}.`],[/Счёт карты (\d+): целое число от 0 до 99\./,m=>`Map ${m[1]} scores must be integers from 0 to 99.`],[/Для сыгранной карты (\d+) укажите название и счёт без ничьей\./,m=>`Completed map ${m[1]} needs a name and non-tied scores.`]];
 for(const [pattern,format] of patterns){const match=message.match(pattern);if(match)return format(match);}
 return /[А-Яа-яЁё]/.test(message)?'Could not save the changes. Check your settings and server connection.':message;
}
