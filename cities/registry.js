// ====================================================================
// CITY REGISTRY — List of all available cities
// The app loads this to show the city switcher
// ====================================================================

const CITY_REGISTRY = [
    {
        slug: "tamale",
        name: "Tamale",
        region: "Northern Region",
        url: "https://tamale-market-finder.vercel.app",
        coords: { lat: 9.4075, lng: -0.8357 },
        zoom: 14,
        markets: [
            "Tamale Central Market",
            "Aboabo Market",
            "Lamashegu Market",
            "Kukuo Market",
            "Larabanga Market"
        ]
    },
    {
        slug: "accra",
        name: "Accra",
        region: "Greater Accra",
        url: "https://accra-market-finder.vercel.app",
        coords: { lat: 5.6037, lng: -0.1870 },
        zoom: 13,
        markets: [
            "Makola Market",
            "Agbogbloshie Market",
            "Madina Market",
            "Kaneshie Market",
            "Osuleman Market",
            "Tema Market",
            "Kotobabi Market"
        ]
    },
    {
        slug: "kumasi",
        name: "Kumasi",
        region: "Ashanti Region",
        url: "https://kumasi-market-finder.vercel.app",
        coords: { lat: 6.6885, lng: -1.6244 },
        zoom: 13,
        markets: [
            "Kejetia Market",
            "Kumasi Central Market",
            "Asafo Market",
            "Adum Market",
            "Bantama Market",
            "Tafo Market"
        ]
    }
];
