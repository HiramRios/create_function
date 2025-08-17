import {describe, it, expect} from "vitest";

import {cartLinesDiscountsGenerateRun} from "./cart_lines_discounts_generate_run";
import {DiscountClass} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

describe("cartLinesDiscountsGenerateRun", () => {
  const baseInput = {
    cart: {
      buyerIdentity: {
        purchasingCompany: {company: {name: "College/gyms/other"}},
      },
      lines: [
        {
          id: "gid://shopify/CartLine/0",
          quantity: 2,
          merchandise: {product: {id: "gid://shopify/Product/1"}},
          cost: {
            amountPerQuantity: {amount: "40"},
            subtotalAmount: {amount: 80},
          },
        },
        {
          id: "gid://shopify/CartLine/1",
          quantity: 1,
          merchandise: {product: {id: "gid://shopify/Product/1"}},
          cost: {
            amountPerQuantity: {amount: "40"},
            subtotalAmount: {amount: 40},
          },
        },
      ],
    },
    discount: {discountClasses: [DiscountClass.Product]},
  };

  it("applies volume pricing across variants of the same product", () => {
    const result = cartLinesDiscountsGenerateRun(baseInput);
    expect(result.operations).toHaveLength(2);
    result.operations.forEach((op, index) => {
      expect(op).toMatchObject({
        productDiscountsAdd: {
          candidates: [
            {
              targets: [{cartLine: {id: `gid://shopify/CartLine/${index}`}}],
              value: {
                fixedAmount: {
                  amount: "5.00",
                  appliesToEachItem: true,
                },
              },
            },
          ],
          selectionStrategy: expect.any(String),
        },
      });
    });
  });

  it("returns no discounts when discount class is missing", () => {
    const input = {
      ...baseInput,
      discount: {discountClasses: []},
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(0);
  });
});

