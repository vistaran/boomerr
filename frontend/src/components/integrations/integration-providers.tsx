import React from "react";
import type { JSX } from "react";
import { Mail, MessageSquareText, Phone } from "lucide-react";
import DiscordIcon from "../../assets/discord-icon.svg";
import FacebookIcon from "../../assets/facebook-icon.svg";
import GoogleAdsIcon from "../../assets/google-ads-icon.svg";
import SlackIcon from "../../assets/slack-icon.svg";
import WhatsappIcon from "../../assets/whatsapp-icon.svg";
import ClickupIcon from "../../assets/clickup-icon.svg";
import TelegramIcon from "../../assets/telegram-icon.svg";

// Helper to map integration key to icon/description for dynamic integrations
export function getProviderMeta(key: string): { icon: JSX.Element | null; description: string; badge?: string } {
	const normalizedKey = (key || "").toLowerCase().replace(/_/g, "-");
	switch (normalizedKey) {
		case "discord":
			return {
				icon: <img src={DiscordIcon} alt="Discord" className="h-6 w-6" />,
				description: "Send alerts to Discord channels via webhooks",
			};
		case "slack":
			return {
				icon: <img src={SlackIcon} alt="Slack" className="h-6 w-6" />,
				description: "Post alerts to Slack channels",
			};
		case "whatsapp":
			return {
				icon: <img src={WhatsappIcon} alt="WhatsApp" className="h-6 w-6" />,
				description: "Send alerts to WhatsApp numbers",
			};
		case "telegram":
			return {
				icon: <img src={TelegramIcon} alt="Telegram" className="h-6 w-6" />,
				description: "Send alerts to Telegram chats or groups",
			};
		case "sms":
			return {
				icon: <MessageSquareText size={24} className="text-sky-500" />,
				description: "Send critical alerts via SMS",
			};
		case "email":
			return {
				icon: <Mail size={24} className="text-red-500/80" />,
				description: "Send alerts via Email",
			};
		case "call":
			return {
				icon: <Phone size={24} className="text-green-500" />,
				description: "Receive critical alerts via phone call",
				badge: "Coming soon",
			};
		case "facebook-ads":
			return {
				icon: <img src={FacebookIcon} alt="Facebook Ads" className="h-6 w-6" />,
				description: "Integrate with Facebook Ads to monitor your campaigns",
			};
		case "google-ads":
			return {
				icon: <img src={GoogleAdsIcon} alt="Google Ads" className="h-6 w-6" />,
				description: "Integrate with Google Ads to monitor your campaigns",
			};
		case "clickup":
			return {
				icon: <img src={ClickupIcon} alt="ClickUp" className="h-6 w-6" />,
				description: "Create tasks in ClickUp when incidents occur",
			};

		default:
			return {
				icon: null,
				description: "Integration",
			};
	}
}