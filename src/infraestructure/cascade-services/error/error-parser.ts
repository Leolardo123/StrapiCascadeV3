const errorParserStrapi = (error: any) => {
  const label = error.path[0];
  // const type = error.name;
  const { message } = error;

  if (/must be unique/.test(message)) {
    return {
      label,
      type: "unique",
      message: `${label} já cadastrado`,
    };
  }
  if (/is required/.test(message)) {
    return {
      label,
      type: "required",
      message: `${label} é obrigatório`,
    };
  }
  if (/is not a valid/.test(message)) {
    return {
      label,
      type: "invalid",
      message: `${label} inválido`,
    };
  }
  if (/must be (\w+) type/.test(message)) {
    return {
      label,
      type: "invalid",
      message: `${label} está no formato inválido`,
    };
  }
  return {
    label,
    type: "invalid",
    message,
  };
};

export { errorParserStrapi };
