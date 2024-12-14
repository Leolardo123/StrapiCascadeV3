/* eslint-disable @typescript-eslint/ban-types */
export enum StrapiTypesEnum {
  string = "string",
  text = "text",
  email = "email",
  password = "password",
  integer = "integer",
  float = "float",
  decimal = "decimal",
  boolean = "boolean",
  binary = "binary",
  uid = "uid",
  enumeration = "enumeration",
  json = "json",
  relation = "relation",
  component = "component",
  dynamiczone = "dynamiczone",
  date = "date",
  time = "time",
  datetime = "datetime",
  timestamp = "timestamp",
  created_by = "created_by",
  updated_by = "updated_by",
}


const formatFieldStrapi = (
  field: string = "field",
  value: string | number | Date | Object | Object[] | null,
  type: string,
  contextError = { context: "formatFieldStrapi" }
) => {
  if (type === "relation") {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (type === StrapiTypesEnum.time) {
    if (typeof value === "string") {
      const baseDate = value;
      if (/\d{2}\D\d{2}/g.test(baseDate)) {
        return `${baseDate.replace(/\D/, ":")}:00.000`;
      }
      if (/\d{2}\D\d{2}\D\d{2}/g.test(baseDate)) {
        return `${baseDate.replace(/\D/, ":")}.000`;
      }
      if (/\d{2}\D\d{2}\D\d{2}\.\d{3}/g.test(baseDate)) {
        return baseDate.replace(/\D/, ":");
      }
      throw new Error(
        `Invalid date format ${value} for ${field} ${contextError.context}`
      );
    }
  }

  return value;
};

export { formatFieldStrapi };
