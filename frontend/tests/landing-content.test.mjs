import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import * as content from "../src/components/landing/landing-content.ts";

test("the public gallery and rooms use the ten approved, existing photos", () => {
  const images = [content.HOTEL_IMAGES?.pool, content.HOTEL_IMAGES?.arrival,
    content.HOTEL_IMAGES?.breakfast, content.HOTEL_IMAGES?.restaurant,
    ...content.ACCOMMODATIONS.map(room => room.image), ...content.LANDING_GALLERY.map(photo => photo.src)];
  assert.equal(new Set(images).size, 10);
  for (const image of images) {
    assert.match(image ?? "", /^\/hotel\/tratadas\//);
    assert.ok(existsSync(new URL(`../public${image}`, import.meta.url)), image);
  }
});

test("the breakfast section has a direct navigation entry", () => {
  assert.ok(content.LANDING_NAVIGATION.some(item => item.href === "#cafe-da-manha"));
});

test("room enquiries preserve the selected category without creating a booking", () => {
  for (const room of content.ACCOMMODATIONS) {
    const url = new URL(content.getRoomReservationUrl(room.name));
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/5551982180262");
    assert.ok(url.searchParams.get("text").includes(room.name));
  }
});
