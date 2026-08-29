export type LocalValidateFailure = "empty" | "length" | "characters";

export function localValidateBarkKey(key: string | null | undefined): LocalValidateFailure | null {
  if (!key) {
    return "empty";
  }
  if (key.length !== 22) {
    return "length";
  }
  if (!/^[A-Za-z0-9]+$/.test(key)) {
    return "characters";
  }
  return null;
}

export function localValidateMessage(failure: LocalValidateFailure): string {
  switch (failure) {
    case "empty":
      return "请输入 Bark 测试链接或 Key";
    case "length":
      return "Bark Key 长度必须为 22 位";
    case "characters":
      return "Bark Key 只能包含字母和数字";
  }
}
