(function attachNothingSportsTicketing(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_TICKETING = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsTicketing(){
  "use strict";

  const VERSION = "ticketing.v1";
  const VERIFIED_SELLER_HOSTS = Object.freeze([
    "ticketmaster.com",
    "www.ticketmaster.com",
    "ticketmaster.com.au",
    "www.ticketmaster.com.au",
    "ticketek.com.au",
    "www.ticketek.com.au",
    "premier.ticketek.com.au",
    "ticketing.formula1.com",
    "feverup.com",
    "www.feverup.com",
  ]);
  const STATUS_LABELS = Object.freeze({
    on_sale: "Buy tickets",
    presale: "Buy presale tickets",
    waitlist: "Join waitlist",
    register_interest: "Register interest",
  });
  const VERIFIED_FIXTURE_TICKETING = Object.freeze({
    "event-afl-cd_m20260142408": Object.freeze({
      provider: "Ticketmaster",
      status: "on_sale",
      url: "https://www.ticketmaster.com.au/event/250064FEBB885F20",
      verifiedAt: "2026-08-23T06:00:00.000Z",
      saleEndAt: "2026-08-23T06:30:00.000Z",
      sourceUrl: "https://www.ticketmaster.com.au/event/250064FEBB885F20",
    }),
    "event-nrl-129992601": Object.freeze({
      provider: "Ticketek",
      status: "on_sale",
      url: "https://premier.ticketek.com.au/events/BRON2626/venues/SUN/performances/EBRC0000026L/tickets",
      verifiedAt: "2026-08-23T06:00:00.000Z",
      saleEndAt: "2026-08-27T12:30:00.000Z",
      sourceUrl: "https://premier.ticketek.com.au/events/BRON2626/venues/SUN/performances/EBRC0000026L/tickets",
    }),
  });

  function verifiedSellerUrl(value){
    try{
      const parsed = new URL(String(value || ""));
      const path = parsed.pathname.replace(/\/+$/, "") || "/";
      return parsed.protocol === "https:"
        && VERIFIED_SELLER_HOSTS.includes(parsed.hostname.toLowerCase())
        && path !== "/"
        && !/^\/(?:search|browse)(?:\/|$)/i.test(path);
    }catch(_error){
      return false;
    }
  }

  function ticketingRecord(event, { reference = new Date() } = {}){
    const eventId = event?.eventId || event?.id;
    const ticketing = event?.ticketing || VERIFIED_FIXTURE_TICKETING[eventId];
    if (!ticketing || typeof ticketing !== "object") return null;
    const status = String(ticketing.status || "").toLowerCase();
    if (!STATUS_LABELS[status] || !ticketing.verifiedAt || !verifiedSellerUrl(ticketing.url)) return null;
    const referenceTime = reference instanceof Date ? reference.getTime() : new Date(reference).getTime();
    const verifiedTime = new Date(ticketing.verifiedAt).getTime();
    const saleStartTime = ticketing.saleStartAt ? new Date(ticketing.saleStartAt).getTime() : null;
    const saleEndTime = ticketing.saleEndAt ? new Date(ticketing.saleEndAt).getTime() : null;
    if (!Number.isFinite(referenceTime) || !Number.isFinite(verifiedTime) || verifiedTime > referenceTime) return null;
    if (Number.isFinite(saleStartTime) && referenceTime < saleStartTime) return null;
    if (Number.isFinite(saleEndTime) && referenceTime > saleEndTime) return null;
    return Object.freeze({
      url: ticketing.url,
      provider: String(ticketing.provider || "Ticket seller"),
      status,
      label: STATUS_LABELS[status],
      verifiedAt: ticketing.verifiedAt,
    });
  }

  function resolve(event, { surface = "fixture", localVenueMatched = false, reference = new Date() } = {}){
    const record = ticketingRecord(event, { reference });
    if (!record) return null;
    const majorEventSurface = surface === "events"
      || Boolean(event?.majorEventId || event?.majorEventParentId || event?.majorEventMarker);
    if (surface === "fixture" && !majorEventSurface && !localVenueMatched) return null;
    return record;
  }

  return Object.freeze({ VERSION, VERIFIED_SELLER_HOSTS, STATUS_LABELS, VERIFIED_FIXTURE_TICKETING, verifiedSellerUrl, ticketingRecord, resolve });
});
