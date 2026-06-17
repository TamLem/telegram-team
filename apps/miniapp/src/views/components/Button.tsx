import type { FC } from "hono/jsx";

export const Button: FC<{
  children?: any;
  variant?: "primary" | "secondary";
  block?: boolean;
  type?: "submit" | "button";
  class?: string;
  style?: string;
  onclick?: string;
}> = ({ children, variant = "primary", block, type = "button", ...props }) => {
  const classes = [
    "btn",
    variant === "secondary" ? "btn-secondary" : "",
    block ? "btn-block" : "",
    props.class ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} class={classes} style={props.style} onclick={props.onclick}>
      {children}
    </button>
  );
};
