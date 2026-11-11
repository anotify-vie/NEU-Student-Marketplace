// Round-half-up price for selected units, using BigInt so large prices stay exact:
// floor((2 * price * selected + quantity) / (2 * quantity))
export function selectedPrice(price,quantity,selected) {
  const total = BigInt(quantity);
  return Number((2n * BigInt(price) * BigInt(selected) + total) / (2n * total));
}
