import HCaptchaLib from "@hcaptcha/react-hcaptcha";
import type { ComponentType } from "react";

const HCaptcha = HCaptchaLib as unknown as ComponentType<any>;

export default HCaptcha;
