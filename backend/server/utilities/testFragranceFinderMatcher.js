const assert = require("assert");
const {
  findBestMatch,
  normalizeText,
  scoreFragranceResults,
} = require("./fragranceFinderApi");

const sauvage = {
  perfume: "Sauvage Dior for men",
  brand: "dior perfumes and colognes",
  image: "https://fimgs.net/mdimg/perfume/375x500.31861.jpg",
  id: "31861",
};

const noImageSauvage = {
  perfume: "Sauvage Dior for men",
  brand: "dior perfumes and colognes",
  id: "31861",
};

const unrelatedDior = {
  perfume: "J'adore Dior for women",
  brand: "dior perfumes and colognes",
  image: "https://fimgs.net/mdimg/perfume/375x500.123.jpg",
  id: "123",
};

const conflictingBrand = {
  perfume: "Sauvage Alt Brand for men",
  brand: "alt brand perfumes and colognes",
  image: "https://fimgs.net/mdimg/perfume/375x500.999.jpg",
  id: "999",
};

const tests = [
  {
    name: "Dior Sauvage matches Sauvage Dior for men",
    run: () => {
      assert.strictEqual(
        findBestMatch([sauvage], { name: "Dior Sauvage", brand: "Dior" }),
        sauvage
      );
    },
  },
  {
    name: "Sauvage and Dior matches the same result",
    run: () => {
      assert.strictEqual(
        findBestMatch([sauvage], { name: "Sauvage", brand: "Dior" }),
        sauvage
      );
    },
  },
  {
    name: "dior perfumes and colognes normalizes to dior",
    run: () => {
      assert.strictEqual(normalizeText("dior perfumes and colognes"), "dior");
    },
  },
  {
    name: "different word order still matches",
    run: () => {
      assert.strictEqual(
        findBestMatch([sauvage], { name: "Sauvage Dior", brand: "Dior" }),
        sauvage
      );
    },
  },
  {
    name: "generic gender suffixes do not prevent a match",
    run: () => {
      assert.strictEqual(
        findBestMatch([sauvage], { name: "Sauvage for men", brand: "Dior" }),
        sauvage
      );
    },
  },
  {
    name: "unrelated Dior fragrance is not accepted for Sauvage",
    run: () => {
      assert.strictEqual(
        findBestMatch([unrelatedDior], { name: "Sauvage", brand: "Dior" }),
        null
      );
    },
  },
  {
    name: "Sauvage fragrance from a conflicting brand is rejected",
    run: () => {
      assert.strictEqual(
        findBestMatch([conflictingBrand], { name: "Sauvage", brand: "Dior" }),
        null
      );
    },
  },
  {
    name: "candidates without an image are skipped",
    run: () => {
      assert.strictEqual(
        findBestMatch([noImageSauvage], { name: "Sauvage", brand: "Dior" }),
        null
      );
    },
  },
  {
    name: "highest valid score is selected instead of the first result",
    run: () => {
      const match = findBestMatch(
        [unrelatedDior, sauvage],
        { name: "Sauvage", brand: "Dior" }
      );
      const scored = scoreFragranceResults(
        [unrelatedDior, sauvage],
        { name: "Sauvage", brand: "Dior" }
      );

      assert.strictEqual(match, sauvage);
      assert.strictEqual(scored[0].id, sauvage.id);
    },
  },
];

for (const test of tests) {
  test.run();
  console.log(`ok - ${test.name}`);
}
