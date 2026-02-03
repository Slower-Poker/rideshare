# RideShare.Click Site Map

Navigation structure after usability improvements. The app uses **React state** (`currentView`) for in-app navigation and **React Router** for the `/join/:code` URL.

---

## Global navigation (AppShell)

A **persistent header** (`AppShell.tsx`) appears on every page with these tabs:

| Tab | View | Purpose |
|-----|------|---------|
| **Home** | `home` | Landing page with 3 action cards |
| **Find Rides** | `findARideMap` | Map of ride requests + list of offers |
| **Book** | `bookRide` | Pick pickup/dropoff on map |
| **Offer** | `offerRide` | Create a ride offer (guests → Account) |
| **Account** | `account` | Sign in, profile, social features, settings |

Users can switch between these 5 sections from **any page** without needing "back" buttons.

---

## Entry points

| Entry | Route | Description |
|-------|-------|-------------|
| **Main app** | `/` (or any path except `/join/:code`) | SPA; view determined by `currentView` state |
| **Join by code** | `/join/:code` | Standalone page to view/join a ride via share link |

---

## Page hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AppShell (always visible)                           │
│  [Home]  [Find Rides]  [Book]  [Offer]  [Account]                          │
└─────────────────────────────────────────────────────────────────────────────┘
        │         │          │        │          │
        ▼         ▼          ▼        ▼          ▼
    ┌───────┐ ┌─────────┐ ┌──────┐ ┌──────┐ ┌─────────┐
    │ Home  │ │Find Ride│ │Book a│ │Offer │ │ Account │
    │       │ │  Map    │ │ Ride │ │a Ride│ │         │
    └───┬───┘ └────┬────┘ └──┬───┘ └──────┘ └────┬────┘
        │          │         │                    │
        │          │         ▼                    ├──► Pools ←───────────┐
        │          │    Book Ride Details         ├──► Connections ←─────┤
        │          │         │                    ├──► Recurring Rides ←─┤ (← back)
        │          │         ▼                    ├──► Ride Planner (AI) │
        │          │    Book Ride Confirm         ├──► Terms             │
        │          │         │                    └──► License           │
        │          │         ▼                                           │
        │          │    Ride Requests (list) ◄───────────────────────────┘
        │          │         │
        │          └─────────┘ (← back to Find Rides)
        │
        └──► Terms (footer)
        └──► License (footer)

Standalone (React Router):
    /join/:code  →  JoinByCodePage  →  Home (/)
```

---

## Page-by-page navigation

### Home (HomePage)
| Link | Target | Notes |
|------|--------|-------|
| "View map" card | `findARideMap` | — |
| "Book a ride" card | `bookRide` | — |
| "Offer a ride" card | `offerRide` / `account` | logged in → offer; guest → account |
| "Sign In" banner | `account` | guest only |
| Terms of Service | `terms` | footer |
| License | `license` | footer |

### Find Rides (FindARideMap)
| Link | Target | Notes |
|------|--------|-------|
| "Ride List" button | `bookaRideRequest` | requests tab |
| "Offer a ride" | `offerRide` / `account` | logged in → offer; guest → account |
| "Request to join" | `/join/:code` | offers tab (React Router) |

### Book a Ride (BookaRide)
| Link | Target | Notes |
|------|--------|-------|
| Next (after route) | `bookRideDetails` | — |

### Book Ride Details (BookRideDetails)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | `bookRide` | — |
| Continue | `bookRideConfirm` | — |

### Book Ride Confirm (BookRideConfirm)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | `bookRideDetails` | — |
| Cancel | `bookRide` | — |
| After success | `account` | — |
| "Post a request instead" | `bookaRideRequest` | — |

### Ride Requests list (BookaRideRequest)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | `findARideMap` | — |
| "Create a Ride Request" | `bookRide` | empty state |

### Account (MyAccountView)
| Link | Target | Notes |
|------|--------|-------|
| Pools | `pools` | — |
| Connections | `connections` | — |
| Recurring Rides | `recurringRides` | — |
| Ride Planner (AI) | `ridePlannerChat` | — |
| Terms of Service | `terms` | Legal section |
| License | `license` | Legal section |
| Sign Out | `home` | — |

### Pools (PoolsView)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | `account` | — |

### Connections (ConnectionsView)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | `account` | — |

### Recurring Rides (RecurringRidesView)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | `account` | — |

### Ride Planner Chat (RidePlannerChat)
| Link | Target | Notes |
|------|--------|-------|
| (no back button) | — | use AppShell nav |
| Sign-in required | `account` | App.tsx redirect |

### Terms (TermsPage)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | previous view | not required |
| After accept | `home` | — |

### License (LicensePage)
| Link | Target | Notes |
|------|--------|-------|
| ← Back | previous view | — |

### Join by Code (JoinByCodePage) — `/join/:code`
| Link | Target | Notes |
|------|--------|-------|
| All links | `/` (Home) | React Router `<Link>` |

---

## Programmatic redirects (App.tsx)

| From | To | Trigger |
|------|----|---------|
| `ridePlannerChat` | `account` | user not logged in |
| `terms` | `home` | user logged in and terms accepted |

---

## View ↔ Component reference

| View key | Component | Access |
|----------|-----------|--------|
| `home` | HomePage | public |
| `findARideMap` | FindARideMap | public |
| `bookRide` | BookaRide | public (booking requires auth) |
| `bookRideDetails` | BookRideDetails | public |
| `bookRideConfirm` | BookRideConfirm | auth |
| `bookaRideRequest` | BookaRideRequest | auth |
| `offerRide` | OfferaRide | auth |
| `ridePlannerChat` | RidePlannerChat | auth |
| `account` | MyAccountView | public (shows sign-in UI for guests) |
| `pools` | PoolsView | auth |
| `connections` | ConnectionsView | auth |
| `recurringRides` | RecurringRidesView | auth |
| `terms` | TermsPage | public |
| `license` | LicensePage | public |

---

## File locations

| Component | Path |
|-----------|------|
| AppShell | `src/components/AppShell.tsx` |
| HomePage | `src/components/HomePage.tsx` |
| FindARideMap | `src/components/FindARideMap.tsx` |
| BookaRide | `src/components/BookaRide.tsx` |
| BookRideDetails | `src/components/BookRideDetails.tsx` |
| BookRideConfirm | `src/components/BookRideConfirm.tsx` |
| BookaRideRequest | `src/components/BookaRideRequest.tsx` |
| OfferaRide | `src/components/OfferaRide.tsx` |
| RidePlannerChat | `src/components/RidePlannerChat.tsx` |
| MyAccountView | `src/components/MyAccountView.tsx` |
| PoolsView | `src/components/PoolsView.tsx` |
| ConnectionsView | `src/components/ConnectionsView.tsx` |
| RecurringRidesView | `src/components/RecurringRidesView.tsx` |
| TermsPage | `src/components/TermsPage.tsx` |
| LicensePage | `src/components/LicensePage.tsx` |
| JoinByCodePage | `src/components/JoinByCodePage.tsx` |
| App (router + state) | `src/App.tsx` |
| main (React Router) | `src/main.tsx` |
