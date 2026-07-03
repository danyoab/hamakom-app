import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Generates the source images that @capacitor/assets expands into every
// Android/iOS icon + splash size. Reuses the same traced HaMakom logo as the
// PWA favicons (scripts/generate-icons.mjs) so all platforms stay on-brand.
const outDir = resolve(process.cwd(), 'assets')
mkdirSync(outDir, { recursive: true })

const logoPath = `
M 478 426 L 457 430 L 437 438 L 417 450 L 397 470 L 382 494 L 375 515 L 373 527 L 373 555 L 379 580 L 394 610 L 446 683 L 518 778 L 521 778 L 522 773 L 549 721 L 563 689 L 458 584 L 451 575 L 441 556 L 439 537 L 442 521 L 450 506 L 458 498 L 472 489 L 486 485 L 506 486 L 516 490 L 527 498 L 536 508 L 541 516 L 546 531 L 546 549 L 541 565 L 533 577 L 519 589 L 511 593 L 488 598 L 521 633 L 555 665 L 559 662 L 581 633 L 601 597 L 612 560 L 613 531 L 608 509 L 597 485 L 582 465 L 565 449 L 550 439 L 529 430 L 509 426 Z
`.trim()

const logoPath2 = `
M 641 421 L 607 422 L 587 427 L 566 436 L 566 438 L 580 446 L 597 463 L 612 485 L 622 481 L 644 481 L 664 490 L 677 504 L 686 526 L 687 539 L 685 555 L 673 577 L 663 587 L 647 597 L 629 602 L 614 601 L 573 660 L 573 662 L 584 669 L 601 648 L 626 612 L 631 609 L 637 609 L 633 618 L 616 643 L 581 685 L 583 693 L 601 731 L 610 755 L 619 771 L 665 710 L 729 618 L 745 586 L 749 573 L 753 544 L 752 526 L 745 499 L 737 482 L 726 466 L 709 449 L 694 438 L 664 425 Z
`.trim()

const LOGO_VB_X = 368, LOGO_VB_Y = 415, LOGO_VB_W = 400, LOGO_VB_H = 375
const LOGO_CX = LOGO_VB_X + LOGO_VB_W / 2
const LOGO_CY = LOGO_VB_Y + LOGO_VB_H / 2

function logoGroup(size, ratio) {
  const logoSize = size * ratio
  const scale = logoSize / Math.max(LOGO_VB_W, LOGO_VB_H)
  const tx = size / 2 - LOGO_CX * scale
  const ty = size / 2 - LOGO_CY * scale
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">
    <path fill="url(#iconGrad)" fill-rule="evenodd" d="${logoPath}"/>
    <path fill="url(#iconGrad)" fill-rule="evenodd" d="${logoPath2}"/>
  </g>`
}

const iconGrad = `<linearGradient id="iconGrad" x1="380" y1="770" x2="760" y2="420" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#FF4D5E"/>
    <stop offset="55%" stop-color="#FF8A72"/>
    <stop offset="100%" stop-color="#FFB183"/>
  </linearGradient>`

function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1f2e"/>
      <stop offset="100%" stop-color="#0D1117"/>
    </linearGradient>
    ${iconGrad}
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>
  ${logoGroup(size, 0.62)}
</svg>`
}

function splashSvg(size, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${iconGrad}</defs>
  <rect width="${size}" height="${size}" fill="${bg}"/>
  ${logoGroup(size, 0.26)}
</svg>`
}

const jobs = [
  { name: 'icon.png', svg: iconSvg(1024) },
  { name: 'splash.png', svg: splashSvg(2732, '#F7F2E8') },
  { name: 'splash-dark.png', svg: splashSvg(2732, '#0D1117') },
]

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).png().toFile(resolve(outDir, job.name))
  console.log(`wrote assets/${job.name}`)
}
