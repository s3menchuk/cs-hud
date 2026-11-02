import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, getLanguage, t, translateError } from '../public/i18n.js';

test('Admin language switches with translated dynamic values and validation errors',()=>{
  setLanguage('en');assert.equal(getLanguage(),'en');assert.equal(t('design'),'Appearance');
  assert.equal(t('mapNumber',{n:3}),'Map 3');
  assert.equal(translateError('Для сыгранной карты 2 укажите название и счёт без ничьей.'),'Completed map 2 needs a name and non-tied scores.');
  assert.equal(t('sideStatus',{side1:'CT',side2:'T'}),'Team 1: CT · Team 2: T · CT on the left');
  setLanguage('ru');assert.equal(t('design'),'Оформление');
  assert.equal(translateError('Выберите текущую карту в пределах серии.'),'Выберите текущую карту в пределах серии.');
  setLanguage('invalid');assert.equal(getLanguage(),'ru');
});
