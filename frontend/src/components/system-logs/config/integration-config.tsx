import { CheckSquare, Mail, Phone, Webhook } from "lucide-react";
import type { ReactNode } from "react";
import { DiscordIcon, SlackIcon, SmsIcon, TelegramIcon, WhatsAppIcon } from "../icons/integration-icons";


export const INTEGRATION_CONFIG: Record<
    string,
    {
        icon: (props: { className?: string }) => ReactNode;
        label: string;
        color: string;
    }
> = {
    discord: {
        icon: DiscordIcon,
        label: "Discord",
        color: "text-indigo-400",
    },

    slack: {
        icon: SlackIcon,
        label: "Slack",
        color: "text-emerald-400",
    },

    telegram: {
        icon: TelegramIcon,
        label: "Telegram",
        color: "text-sky-400",
    },

    clickup: {
        icon: ({ className }) => <CheckSquare className={className} />,
        label: "ClickUp",
        color: "text-purple-400",
    },

    whatsapp: {
        icon: WhatsAppIcon,
        label: "WhatsApp",
        color: "text-green-400",
    },

    sms: {
        icon: SmsIcon,
        label: "SMS",
        color: "text-blue-400",
    },

    call: {
        icon: ({ className }) => <Phone className={className} />,
        label: "Call",
        color: "text-amber-400",
    },

    email: {
        icon: ({ className }) => <Mail className={className} />,
        label: "Email",
        color: "text-rose-400",
    },

    webhook: {
        icon: ({ className }) => <Webhook className={className} />,
        label: "Webhook",
        color: "text-amber-400",
    },
};
