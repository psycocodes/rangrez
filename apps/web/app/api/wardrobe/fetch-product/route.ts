import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireUser();

    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Please provide a valid product URL." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format." }, { status: 400 });
    }

    const domain = parsedUrl.hostname.replace(/^www\./, "");
    let brand = domain.split(".")[0];
    brand = brand.charAt(0).toUpperCase() + brand.slice(1);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Could not reach ${domain} (Status ${response.status}).` },
        { status: 422 },
      );
    }

    const html = await response.text();

    // Extract OpenGraph, Twitter, and Schema metadata
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);

    let title = ogTitleMatch ? ogTitleMatch[1].trim() : "Shopping Garment";
    title = title.replace(/\s*(\||\-|_|–).*$/, "").trim(); // Remove site suffix

    let imageUrl = ogImageMatch ? ogImageMatch[1].trim() : null;

    // Search for JSON-LD images
    const images: string[] = [];
    if (imageUrl) images.push(imageUrl);

    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match[1]);
        const extractImages = (obj: any) => {
          if (!obj) return;
          if (typeof obj.image === "string") images.push(obj.image);
          if (Array.isArray(obj.image)) {
            obj.image.forEach((img: any) => {
              if (typeof img === "string") images.push(img);
              else if (typeof img?.url === "string") images.push(img.url);
            });
          }
          if (obj.name && typeof obj.name === "string" && !title) {
            title = obj.name;
          }
        };

        if (Array.isArray(json)) json.forEach(extractImages);
        else extractImages(json);
      } catch {
        // Skip invalid JSON-LD
      }
    }

    // Fallback: extract large product images from img tags
    const imgMatches = html.matchAll(/<img[^>]*src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*>/gi);
    for (const match of imgMatches) {
      if (images.length >= 6) break;
      const src = match[1];
      if (!images.includes(src) && !src.includes("logo") && !src.includes("icon")) {
        images.push(src);
      }
    }

    if (!imageUrl && images.length > 0) {
      imageUrl = images[0];
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No product image found on this page. Try saving or uploading the image directly." },
        { status: 404 },
      );
    }

    // Clean relative URLs
    if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;

    // Infer category/rail
    const lowerTitle = (title + " " + parsedUrl.pathname).toLowerCase();
    let suggestedKind = "top";
    if (/pant|trouser|jeans|denim|short|skirt|legging|jogger|bottom/i.test(lowerTitle)) {
      suggestedKind = "bottom";
    } else if (/jacket|coat|blazer|bomber|hoodie|cardigan|sweater|vest|outerwear/i.test(lowerTitle)) {
      suggestedKind = "outerwear";
    } else if (/shoe|sneaker|boot|loafer|slide|sandal|heel/i.test(lowerTitle)) {
      suggestedKind = "shoes";
    } else if (/bag|belt|scarf|sunglasses|hat|cap|accessory/i.test(lowerTitle)) {
      suggestedKind = "accessory";
    }

    return NextResponse.json({
      success: true,
      product: {
        title,
        brand,
        imageUrl,
        images: Array.from(new Set(images)),
        suggestedKind,
        sourceUrl: url,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to extract product link." },
      { status: 500 },
    );
  }
}
