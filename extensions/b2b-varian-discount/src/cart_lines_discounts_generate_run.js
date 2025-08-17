import {DiscountClass, ProductDiscountSelectionStrategy} from '../generated/api';


/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */

export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    throw new Error('No cart lines found');
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return {operations: []};
  }

  // Volume pricing rules per catalog. Quantities represent the minimum number
  // of items across all variants of a product required to receive the price.
  // Additional catalogs can be added to this object as needed.
  const CATALOG_VOLUME_PRICING = {
    'College/gyms/other': [
      {quantity: 1, price: 40},
      {quantity: 3, price: 35},
      {quantity: 12, price: 32},
    ],
    'Catalog Professional': [
      {quantity: 1, price: 35},
      {quantity: 2, price: 30},
      {quantity: 10, price: 25},
    ],
  };

  // Determine the current catalog based on the buyer's company name. If the
  // company isn't found, default volume pricing rules are not applied.
  const catalogName =
    input.cart?.buyerIdentity?.purchasingCompany?.company?.name || '';

  const catalogPricing = CATALOG_VOLUME_PRICING[catalogName];
  if (!catalogPricing) {
    return {operations: []};
  }

  // Group cart lines by product ID to aggregate quantities across variants.
  const productGroups = new Map();
  for (const line of input.cart.lines) {
    const productId = line.merchandise.product.id;
    const group = productGroups.get(productId) || {lines: [], quantity: 0};
    group.lines.push(line);
    group.quantity += line.quantity;
    productGroups.set(productId, group);
  }

  const operations = [];

  for (const group of productGroups.values()) {
    // Determine the best pricing tier for the aggregated quantity.
    const tier = catalogPricing
      .filter((t) => group.quantity >= t.quantity)
      .sort((a, b) => b.quantity - a.quantity)[0];

    if (!tier) continue;

    for (const line of group.lines) {
      const unitPrice = parseFloat(line.cost.amountPerQuantity.amount);
      const discountPerItem = unitPrice - tier.price;
      if (discountPerItem <= 0) continue;
      operations.push({
        productDiscountsAdd: {
          candidates: [
            {
              targets: [{cartLine: {id: line.id}}],
              value: {
                fixedAmount: {
                  amount: discountPerItem.toFixed(2),
                  appliesToEachItem: true,
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      });
    }
  }

  return {operations};
}