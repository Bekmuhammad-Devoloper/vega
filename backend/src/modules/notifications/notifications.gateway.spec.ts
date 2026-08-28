import { NotificationsGateway } from './notifications.gateway';

/**
 * Ko'p-ijarachi izolyatsiya testi.
 *
 * Ilgari hamma do'kon egasi bitta `admin-live` xonasida edi, ya'ni har biri
 * BOSHQA do'konlarning buyurtma/mijoz/support hodisalarini jonli ko'rardi.
 * Bu test hodisa faqat O'Z do'koni xonasiga borishini tekshiradi.
 */
describe('NotificationsGateway — do\'konlar ajratilishi', () => {
  /** `server.to(room).emit(event, payload)` chaqiruvlarini yozib boruvchi soxta server. */
  function makeServer() {
    const sent: Array<{ room: string; event: string; payload: unknown }> = [];
    const server = {
      to(room: string) {
        return {
          emit(event: string, payload: unknown) {
            sent.push({ room, event, payload });
          },
        };
      },
    };
    return { server, sent };
  }

  function makeGateway() {
    const gw = new NotificationsGateway(
      {} as never, // JwtService — bu testda ishlatilmaydi
      {} as never, // PrismaService — bu testda ishlatilmaydi
    );
    const { server, sent } = makeServer();
    (gw as unknown as { server: unknown }).server = server;
    return { gw, sent };
  }

  it('buyurtma hodisasi FAQAT o\'z do\'koni xonasiga boradi', () => {
    const { gw, sent } = makeGateway();

    gw.onOrderStatusChanged({ tenantId: 'shop-A' } as never);

    const rooms = sent.map((s) => s.room);
    expect(rooms).toContain('admin-live:shop-A');
    // Begona do'kon xonasiga HECH QACHON ketmasligi kerak
    expect(rooms).not.toContain('admin-live:shop-B');
    // Eski umumiy xona ham ishlatilmaydi
    expect(rooms).not.toContain('admin-live');
  });

  it('mijoz harakati va support murojaati ham ajratilgan', () => {
    const { gw, sent } = makeGateway();

    gw.onUserEvent({ tenantId: 'shop-A' } as never);
    gw.onSupportTicket({ tenantId: 'shop-B' } as never);

    const userEventRooms = sent.filter((s) => s.event === 'user-event').map((s) => s.room);
    const ticketRooms = sent.filter((s) => s.event === 'support-new-ticket').map((s) => s.room);

    expect(userEventRooms).toContain('admin-live:shop-A');
    expect(userEventRooms).not.toContain('admin-live:shop-B');

    expect(ticketRooms).toContain('admin-live:shop-B');
    expect(ticketRooms).not.toContain('admin-live:shop-A');
  });

  it('tenantId yo\'q hodisa HECH KIMGA yuborilmaydi (fail-closed)', () => {
    const { gw, sent } = makeGateway();

    gw.onOrderStatusChanged({} as never);
    gw.onUserEvent({ tenantId: null } as never);

    // Ilgari bunday hodisa HAMMAGA ketardi — endi umuman yuborilmaydi.
    expect(sent).toHaveLength(0);
  });

  it('platforma egasi hamma do\'kon hodisasini ko\'radi', () => {
    const { gw, sent } = makeGateway();

    gw.onOrderStatusChanged({ tenantId: 'shop-A' } as never);

    expect(sent.map((s) => s.room)).toContain('admin-live:platform');
  });
});
