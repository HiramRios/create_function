import {
    DiscountApplicationStrategy,
    run,
} from "../generated/api";

/**
 * ==== EDIT THESE CONSTANTS =========================================
 */

// Company **LOCATION** names that should get Professional pricing
const PROFESSIONAL_LOCATION_NAMES = [
    "Das test",
    "Hiram My Company",
    "Texas Solutions",
];

// Product(s) to control by Product GID
// Replace the Xs with your real product GID(s): "gid://shopify/Product/1234567890"
const TARGET_PRODUCTS = [
    "gid://shopify/Product/9114452263135",
];

// College/Gym/Other tiers
const COLLEGE_GYM_OTHER_TIERS = [
    { min: 3, unitPriceCents: 3200 }, // $32.00 at 3+
    { min: 2, unitPriceCents: 3500 }, // $35.00 at 2+
    { min: 1, unitPriceCents: 4000 }, // $40.00 base
];

// Professional tiers
const PROFESSIONAL_TIERS = [
    { min: 3, unitPriceCents: 2500 }, // $25.00 at 3+
    { min: 2, unitPriceCents: 3000 }, // $30.00 at 2+
    { min: 1, unitPriceCents: 3500 }, // $35.00 base
];

/**
 * ==== DO NOT EDIT BELOW ============================================
 */

function toCents(amountStr) {
    const [i, f = ""] = String(amountStr).split(".");
    return parseInt(i || "0", 10) * 100 + parseInt((f + "00").slice(0, 2), 10);
}

function pickTier(tiers, totalQty) {
    let chosen = null;
    const ordered = [...tiers].sort((a, b) => a.min - b.min);
    for (const t of ordered)
        if (totalQty >= t.min) chosen = t;
    return chosen;
}

export default run(({ input }) => {
    // B2B-only
    const isB2B = Boolean(input.cart ? .buyerIdentity ? .company);
    if (!isB2B) {
        return {
            discounts: [],
            discountApplicationStrategy: DiscountApplicationStrategy.Maximum,
        };
    }

    const locationName = input.cart ? .buyerIdentity ? .companyLocation ? .name || "";

    // Choose tier table based on company location
    const tiersForBuyer = PROFESSIONAL_LOCATION_NAMES.includes(locationName) ?
        PROFESSIONAL_TIERS :
        COLLEGE_GYM_OTHER_TIERS;

    // Group lines by product for target products
    const linesByProduct = new Map(); // productId => [{ lineId, qty, currency, unitCents }]
    const totals = new Map(); // productId => totalQty

    for (const line of input.cart.lines) {
        const merch = line.merchandise;
        if (!merch || merch.__typename !== "ProductVariant") continue;

        const productId = merch.product.id;
        if (!TARGET_PRODUCTS.includes(productId)) continue;

        const qty = line.quantity || 0;
        const unitCents = toCents(line.cost.amountPerQuantity.amount);
        const currency = line.cost.amountPerQuantity.currencyCode;

        if (!linesByProduct.has(productId)) linesByProduct.set(productId, []);
        linesByProduct.get(productId).push({
            lineId: line.id,
            qty,
            unitCents,
            currency,
        });

        totals.set(productId, (totals.get(productId) || 0) + qty);
    }

    const discounts = [];

    for (const [productId, infos] of linesByProduct.entries()) {
        const totalQty = totals.get(productId) || 0;
        const tier = pickTier(tiersForBuyer, totalQty);
        if (!tier) continue;

        // Lower each line’s per-unit price down to the tier (never raise price)
        for (const info of infos) {
            const perItemReduction = Math.max(0, info.unitCents - tier.unitPriceCents);
            if (perItemReduction <= 0) continue;

            discounts.push({
                message: "Wholesale tier price",
                targets: [{ cartLine: { id: info.lineId } }],
                value: {
                    fixedAmount: {
                        amount: (perItemReduction / 100).toFixed(2),
                        currencyCode: info.currency,
                    },
                },
            });
        }
    }

    return {
        discounts,
        discountApplicationStrategy: DiscountApplicationStrategy.Maximum,
    };
});