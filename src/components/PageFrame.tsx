import type {ReactNode} from 'react';
import {
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
  VStack,
} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';

export function PageFrame({
  title,
  subtitle,
  titleEnd,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  titleEnd?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Layout
      height="fill"
      header={
        <LayoutHeader hasDivider>
          <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
            <VStack gap={1}>
              <HStack gap={3} vAlign="center">
                <Heading level={2}>{title}</Heading>
                {titleEnd}
              </HStack>
              {subtitle ? (
                <Text type="supporting" color="secondary">
                  {subtitle}
                </Text>
              ) : null}
            </VStack>
            {actions ? (
              <HStack gap={2} vAlign="center">
                {actions}
              </HStack>
            ) : null}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>{children}</VStack>
        </LayoutContent>
      }
    />
  );
}
