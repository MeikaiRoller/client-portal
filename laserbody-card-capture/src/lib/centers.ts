export const CENTERS = [
  {
    id: "3d342ee5-d01f-48de-a72a-ae79df30d559",
    code: "BR",
    name: "Brampton",
    address: "160 Main St S, Brampton, ON L6Y 1N2",
  },
  {
    id: "b6af66bc-5289-4dc2-8703-2ac934df62cc",
    code: "DM",
    name: "Don Mills",
    address: "15 Marie Labatte Rd, Toronto, ON M3C 0J1",
  },
  {
    id: "ae644148-bbd7-432b-8688-f3524cf395ef",
    code: "HM",
    name: "Supernatural - HM",
    address: "101 Locke St S #6, Hamilton, ON L8P 4A6",
  },
  {
    id: "42eb53ab-24a0-4a70-ba2d-4e7e0846fc3d",
    code: "MS",
    name: "Mississauga",
    address: "802 Southdown Rd Unit C3, Mississauga, ON L5J 2Y4",
  },
  {
    id: "b12c77da-ca60-4aab-94a6-070ec8d5c6fc",
    code: "OV",
    name: "Oakville",
    address: "2501 Prince Michael Drive C1, Oakville, ON L6H 0E9",
  },
  {
    id: "b67a9d8b-b577-4e6b-86a5-4f0698795883",
    code: "PK",
    name: "Pickering",
    address: "375 Kingston Rd, Pickering, ON L1V 1A3",
  },
  {
    id: "aa5f2ef2-f953-45f9-b2eb-77d8c78972b3",
    code: "RH",
    name: "Richmond Hill",
    address: "11160 Yonge St #11, Richmond Hill, ON L4S 1K9",
  },

] as const;

export type Center = (typeof CENTERS)[number];
export type CenterId = Center["id"];
