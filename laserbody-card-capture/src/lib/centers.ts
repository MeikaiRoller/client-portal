export const CENTERS = [
  { id: "3d342ee5-d01f-48de-a72a-ae79df30d559", code: "BR", name: "Brampton" },
  { id: "b6af66bc-5289-4dc2-8703-2ac934df62cc", code: "DM", name: "Don Mills" },
  { id: "ae644148-bbd7-432b-8688-f3524cf395ef", code: "HM", name: "Supernatural - HM" },
  { id: "42eb53ab-24a0-4a70-ba2d-4e7e0846fc3d", code: "MS", name: "Mississauga" },
  { id: "b12c77da-ca60-4aab-94a6-070ec8d5c6fc", code: "OV", name: "Oakville" },
  { id: "b67a9d8b-b577-4e6b-86a5-4f0698795883", code: "PK", name: "Pickering" },
  { id: "aa5f2ef2-f953-45f9-b2eb-77d8c78972b3", code: "RH", name: "Richmond Hill" },

] as const;

export type Center = (typeof CENTERS)[number];
export type CenterId = Center["id"];
