export const modules = [
  {
    id: "purchase",
    nav: "Purchase",
    kicker: "Buying a home",
    title: "Purchase mortgage",
    summary: "A loan that pays the seller, so you can move in with a down payment instead of the full price.",
    blurb: "Price, down payment, taxes, and insurance — one monthly number.",
  },
  {
    id: "refinance",
    nav: "Refinance",
    kicker: "Replacing a loan",
    title: "Refinance",
    summary: "A new mortgage that pays off the one you have. People use it to lower the rate, change the term, or take cash out.",
    blurb: "Compare the payment you have with the payment you would get.",
  },
  {
    id: "commercial",
    nav: "Commercial",
    kicker: "Property that earns",
    title: "Commercial mortgage",
    summary: "Financing for offices, shops, apartments, and other property a business owns. The building's income matters as much as the borrower.",
    blurb: "Payment, balloon balance, and whether the rent covers the debt.",
  },
  {
    id: "community",
    nav: "Community",
    kicker: "Buying with help",
    title: "Community lending",
    summary: "Home loans paired with grants, soft seconds, or discounted rates so neighbors can buy with less cash up front.",
    blurb: "See how assistance changes the loan, the payment, and the ratios.",
  },
];

export const guides = {
  purchase: {
    lead: "You are not writing a check for the whole house. A purchase mortgage covers the gap between the price and the cash you bring, and you pay it back a little at a time.",
    hero: {
      src: "images/family-laughing.jpg",
      alt: "A family laughing together on a picnic blanket outdoors",
    },
    photos: [
      {
        src: "images/house-front.jpg",
        alt: "A light-colored house with a front porch and green lawn",
        caption: "The house is the collateral. If the loan is not repaid, the lender can sell it.",
      },
      {
        src: "images/keys-closing.jpg",
        alt: "A person holding house keys in front of a new home",
        caption: "Closing day is when the seller is paid and the keys change hands.",
      },
    ],
    sections: [
      {
        heading: "How the money moves",
        paragraphs: [
          "You agree on a price with the seller. Your down payment plus the lender's money equals that price. A $450,000 home with $45,000 down needs a $405,000 loan.",
          "Each month, part of the payment is interest — the lender's charge for the month — and part reduces what you still owe. Early payments are mostly interest. Later payments are mostly principal. That shift is amortization.",
        ],
      },
      {
        heading: "What the monthly bill actually includes",
        paragraphs: [
          "Principal and interest are only the loan. Most owners also escrow property tax and home insurance, and some pay an HOA fee. If you put down less than 20%, lenders usually add mortgage insurance until you have enough equity.",
          "The calculator on this page adds those pieces so the number looks like the housing payment, not just the loan payment.",
        ],
      },
      {
        heading: "The path from offer to keys",
        steps: [
          "Get a preapproval so you know a realistic price range before you shop.",
          "Make an offer. Once it is accepted, the lender orders an appraisal and verifies income, assets, and credit.",
          "You receive a Loan Estimate, then a Closing Disclosure at least three business days before signing.",
          "At closing you pay the down payment and closing costs. The lender pays the seller. You start monthly payments the following month.",
        ],
      },
      {
        heading: "A buydown, if the seller or builder helps",
        paragraphs: [
          "Sometimes a seller or builder pays money up front so your interest rate — and your payment — is lower for the first year or two. After that, the payment rises to the note rate. The loan itself does not grow.",
          "That temporary discount is a buydown. If your loan already has one and you want the month-by-month schedule, including extra principal or a recast, open the buydown schedule below.",
        ],
      },
    ],
    aside: "This page estimates principal, interest, tax, insurance, and mortgage insurance. It is not a Loan Estimate and it does not include every closing cost.",
  },
  refinance: {
    lead: "A refinance is a new loan whose first job is to pay off the old one. You stay in the same house. The question is whether the new terms are worth the cost of getting them.",
    hero: {
      src: "images/planning-desk.jpg",
      alt: "Two people reviewing papers and a laptop at a wooden desk",
    },
    photos: [
      {
        src: "images/advisor-meeting.jpg",
        alt: "A loan advisor meeting with clients across a table",
        caption: "A refinance is a full loan application, even if you already live in the house.",
      },
      {
        src: "images/neighborhood.jpg",
        alt: "A row of homes on a quiet residential street",
        caption: "The same house, a new note. Equity is what you own above the loan balance.",
      },
    ],
    sections: [
      {
        heading: "Three reasons people refinance",
        paragraphs: [
          "Rate-and-term: replace a higher rate, or switch a 30-year loan to a 15-year loan, without taking money out. The new loan is about the size of the old balance, plus any costs you choose to finance.",
          "Cash-out: borrow more than you owe and keep the difference. People use it for repairs or to consolidate higher-interest debt. The new balance is larger, so the payment can rise even if the rate falls.",
          "Term change: stretching the remaining years lowers the payment but usually increases total interest. Shortening the term does the opposite.",
        ],
      },
      {
        heading: "Closing costs and the break-even month",
        paragraphs: [
          "A refinance is not free. Appraisal, title, lender fees, and recording charges often run several thousand dollars. You can pay them at closing or roll some of them into the new loan.",
          "Break-even is the simple test: divide the costs by the monthly payment drop. If costs are $6,000 and the payment falls by $200, you need about 30 months before the savings have paid for the refinance. Moving or refinancing again before that can erase the benefit.",
        ],
      },
      {
        heading: "What the process looks like",
        steps: [
          "Compare the rate, the new term, and a written estimate of costs. Ask which costs are financed.",
          "Apply. The lender verifies income and orders an appraisal if the program requires one.",
          "You review the Closing Disclosure. Many refinances have a three-day right to cancel after signing.",
          "The new lender pays off the old lender. Your next payment goes to the new loan, often after one skipped month while the payoff posts.",
        ],
      },
    ],
    aside: "A lower payment is not automatically a win. A longer term can cut the monthly bill and still cost more interest over the life of the loan.",
  },
  commercial: {
    lead: "A commercial mortgage finances property that produces income or houses a business: an office, a shop, a warehouse, a small apartment building. Lenders underwrite the property, not only the person signing.",
    hero: {
      src: "images/office-tower.jpg",
      alt: "A glass office tower against a blue sky",
    },
    photos: [
      {
        src: "images/office-team.jpg",
        alt: "Coworkers talking around a laptop in a bright office",
        caption: "Offices, clinics, and mixed-use buildings are typical commercial collateral.",
      },
      {
        src: "images/storefront.jpg",
        alt: "A person walking past a lit shopfront at dusk",
        caption: "A store's rent, not just the owner's salary, is what repays many of these loans.",
      },
    ],
    sections: [
      {
        heading: "Why it does not work like a home loan",
        paragraphs: [
          "Home loans are often fixed for 30 years and pay down to zero. Commercial loans are usually shorter. A common shape is a 25-year amortization inside a 5, 7, or 10-year term. Payments are calculated as if the loan lasted 25 years, but the remaining balance comes due when the term ends. That leftover balance is the balloon.",
          "Some loans start interest-only, so early payments do not reduce the balance at all. That keeps cash in the business while a tenant builds out a space or a renovation is leased up. It also means the balloon is larger.",
        ],
      },
      {
        heading: "The two ratios lenders say out loud",
        paragraphs: [
          "Loan-to-value is the loan divided by the property value. A $1.26 million loan on a $1.8 million building is 70% LTV. Lower is safer for the lender and usually priced better.",
          "Debt-service coverage is the property's yearly net operating income divided by the yearly loan payment. Net operating income is rent and other income minus operating expenses, before the mortgage. A ratio of 1.25 means the building earns $1.25 for every $1.00 of debt payment. Many lenders want at least 1.20 to 1.25.",
        ],
      },
      {
        heading: "How a deal usually proceeds",
        steps: [
          "Gather rent rolls, leases, and trailing expenses. Lenders want to see the income, not a projection alone.",
          "The lender sizes the loan from value, income, and the borrower's experience. Expect a personal guarantee on smaller loans.",
          "An appraisal and often an environmental review come before a commitment letter.",
          "At closing, the lender takes a mortgage on the property. Plan for the balloon well before the term ends — refinance, sell, or pay it down.",
        ],
      },
    ],
    aside: "The coverage ratio here uses the amortizing payment, not a teaser interest-only payment. A lender may calculate it differently.",
  },
  community: {
    lead: "Community lending is ordinary home financing plus a local boost: a grant, a forgivable second loan, or a lower rate from a housing agency, a credit union, or a bank's community program. The goal is a sustainable payment, not a bigger house than the income can carry.",
    hero: {
      src: "images/community-circle.jpg",
      alt: "A diverse group of neighbors standing together outdoors",
    },
    photos: [
      {
        src: "images/apartment-community.jpg",
        alt: "A modern apartment community with balconies and trees",
        caption: "Programs often focus on starter homes, condos, and modest multifamily buildings.",
      },
      {
        src: "images/friends.jpg",
        alt: "Friends sitting close together and smiling at the camera",
        caption: "Many buyers use help from a program and still bring some of their own savings.",
      },
    ],
    sections: [
      {
        heading: "What the help usually is",
        paragraphs: [
          "Down-payment assistance can be a grant you do not repay, or a second loan with no monthly payment that is forgiven after you live in the home for a set number of years. Either way, it reduces the first mortgage, which reduces the payment.",
          "Some programs also discount the interest rate or pay closing costs. They almost always require the home to be your primary residence, and many have income or purchase-price limits tied to the county.",
        ],
      },
      {
        heading: "Two ratios, in plain language",
        paragraphs: [
          "The housing ratio is the monthly housing payment divided by gross monthly income, before taxes. The total-debt ratio adds car loans, student loans, and card minimums. A program might allow 35% for housing and 45% for all debts. Those are guidelines, not a promise of approval.",
          "Assistance helps both ratios because it shrinks the loan. It does not help if the other debts are already high. Paying down a car loan can matter as much as finding a grant.",
        ],
      },
      {
        heading: "How a buyer actually uses a program",
        steps: [
          "Talk to a lender or housing counselor who works with the local programs before you write an offer. Not every seller accepts every assistance type.",
          "Take a homebuyer education class if the program requires one. Many do, and the class is useful even when it is optional.",
          "Get approved for the first mortgage and the assistance together. The assistance often has its own paperwork and a separate closing deadline.",
          "At closing, program funds arrive alongside your own funds. Keep the occupancy and resale rules — selling too soon can trigger repayment.",
        ],
      },
    ],
    aside: "Program rules change by city and by year. Use this page to understand the math, then confirm the current grant, income limit, and forgiveness terms with the agency.",
  },
};
