const camelToSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamelCase = str => str.replace(/(_\w)/g, letter => letter[1].toUpperCase());

export { camelToSnakeCase, snakeToCamelCase };