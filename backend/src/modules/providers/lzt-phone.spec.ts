import { LztProvider } from './lzt.provider';

describe('LZT telefon raqamini ajratish', () => {
  it('shifrlangan login ichidagi raqamlarni telefon deb olmaydi, telegram_phone ishlatiladi', () => {
    const item = {
      telegram_phone: '998999527163',
      login: '0ad155ef3acf2e8e164d99bfda0b465af414a540a7786a0396f176728031fba787de1999e018b27f',
      loginData: { login: '0ad155ef3acf2e8e164d99bfda0b465af414a540a7786a0396f176728031fba787de1999e018b27f' },
    };
    expect(LztProvider.findPhone(item)).toBe('+998999527163');
  });

  it('faqat hex login bo\'lsa — raqam yo\'q (null)', () => {
    expect(LztProvider.findPhone({ loginData: { login: '4734519a0408d0adb267ea5646d69fb2d5583441' } })).toBeNull();
  });

  it('oddiy "raqam:parol" login hali ham ishlaydi', () => {
    expect(LztProvider.findPhone({ loginData: { login: '+998901234567:secret' } })).toBe('+998901234567');
  });
});
