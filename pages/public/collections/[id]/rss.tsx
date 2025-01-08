import React from "react";
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/api/db";
import { ArchivedFormat } from "@/types/global";

import RSS from "rss";

const RSSFeed: React.FC = () => null;

export const getServerSideProps: GetServerSideProps = async ({
  params,
  query,
  res,
  req,
}) => {
  const id = Number(params?.id as string);
  const format = Number(query?.format as string)

  if (isNaN(id) || !id) {
    if (res) {
      res.statusCode = 404;
      res.end();
    }
    return { props: {} };
  }

  const data = await prisma.collection.findUnique({
    where: {
      id,
      isPublic: true,
    },
    include: {
      links: {
        orderBy: {
          id: "desc",
        },
        take: 20,
      },
    },
  });

  if (!data) {
    res.statusCode = 404;
    res.end("Not Found");
    return { props: {} };
  }

  const host = req.headers.host;

  const protocol =
    req.headers["x-forwarded-proto"] || (req.socket ? "https" : "http");
  const siteUrl = `${protocol}://${host}/public/collections/${data.id}`;
  const feedUrl = `${protocol}://${host}/public/collections/${data.id}/rss`;

  const feed = new RSS({
    title: data.name,
    description: data.description,
    site_url: siteUrl,
    feed_url: feedUrl,
    custom_elements: [
      { 'content:encoded': 'content' }
    ]
  });


  for (const link of data.links) {
    const item = {
      title: link.name,
      description: link.description,
      url: `${protocol}://${host}/public/preserved/${link.id}?format=${format}`,
      date: link.createdAt,
    } as RSS.ItemOptions

    if (format === ArchivedFormat.readability) {
      const response = await fetch(`${protocol}://${host}/api/v1/archives/${link.id}?format=${format}`);
      const data = await response.json();
      item.custom_elements = [{
        'content:encoded': `<![CDATA[${data.content}]]>`,
      }]
    } else if (format === ArchivedFormat.monolith) {
      const response = await fetch(`${protocol}://${host}/api/v1/archives/${link.id}?format=${format}`);
      const data = await response.json();
      item.custom_elements = [{
        'content:encoded': `<![CDATA[${data.content}]]>`,
      }]
    } else if (format === ArchivedFormat.pdf) {
      item.enclosure = {
        url: `${protocol}://${host}/public/preserved/${link.id}?format=${format}`,
        type: "application/pdf"
      }
    } else if (format === ArchivedFormat.png) {
      item.enclosure = {
        url: `${protocol}://${host}/public/preserved/${link.id}?format=${format}`,
        type: "image/png"
      }
    } else if (format === ArchivedFormat.jpeg) {
      item.enclosure = {
        url: `${protocol}://${host}/public/preserved/${link.id}?format=${format}`,
        type: "image/jpeg"
      }
    } else {
      item.url = link.url || ""
    }

    feed.item(item)
  }


  const xml = feed.xml({ indent: true });

  if (res) {
    res.setHeader("Content-Type", "text/xml");
    res.write(xml);
    res.end();
  }

  return { props: {} };
};

export default RSSFeed;
